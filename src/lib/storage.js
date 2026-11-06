import sharp from 'sharp';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { connectDB } from './db.js';
import { HttpError } from './errors.js';
import { escapeRegex } from './validate.js';
import { cloudinarySettings, cloudinaryEnabled, cloudinaryCloudName, explainCloudinaryError } from './cloudinarySettings.js';

export { cloudinaryEnabled, cloudinaryProblem } from './cloudinarySettings.js';

// Pictures go to Cloudinary when it is set up, otherwise into the database (served from /api/files/<id>).
// When Cloudinary settings are given but unusable, pictures are refused with what to fix (not silently kept
// in the database). CVs from job applications are always kept privately in the database.

export const MEDIA_BUCKET = 'media';
export const RESUME_BUCKET = 'resumes';

const IMAGE_TYPES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp', gif: 'gif', avif: 'avif' };
export const MAX_IMAGE_UPLOAD = 25 * 1024 * 1024; // what the admin may send
const MAX_STORED = 9.5 * 1024 * 1024; // Cloudinary's free plan accepts up to 10 MB per picture
const MAX_SIDE = 5000;

// The Cloudinary library, loaded only when a picture goes to Cloudinary, with the settings chosen in
// cloudinarySettings.js (never its own reading of CLOUDINARY_URL).
async function cld() {
  const { creds } = cloudinarySettings();
  const { v2: cloudinary } = await import('cloudinary');
  const opts = { ...creds, secure: true };
  if (process.env.CLOUDINARY_UPLOAD_PREFIX) opts.upload_prefix = process.env.CLOUDINARY_UPLOAD_PREFIX;
  cloudinary.config(opts);
  return cloudinary;
}

function shortId() {
  return randomBytes(4).toString('hex');
}

function baseName(filename) {
  const s = String(filename || 'image')
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'image';
}

// Check the picture and make very large ones web-friendly (keeps the format; very big photos become JPEG/WebP).
export async function prepareImage(buffer) {
  let meta;
  try {
    meta = await sharp(buffer, { animated: true, limitInputPixels: 268402689 }).metadata();
  } catch {
    throw new HttpError(415, 'This file is not a picture that can be used. Please upload a JPG, PNG, WebP, GIF or AVIF image.');
  }
  if (!IMAGE_TYPES[meta.format]) {
    const hint = meta.format === 'heif' ? ' iPhone HEIC photos: export them as JPG first.' : meta.format === 'svg' ? ' SVG files are not allowed for safety.' : '';
    throw new HttpError(415, `Please upload a JPG, PNG, WebP, GIF or AVIF image.${hint}`);
  }
  const animated = (meta.pages || 1) > 1;
  let width = meta.width;
  let height = animated && meta.pageHeight ? meta.pageHeight : meta.height;
  if ((meta.orientation || 1) >= 5) [width, height] = [height, width];
  if (buffer.length <= MAX_STORED && Math.max(width, height) <= MAX_SIDE) {
    return { buffer, format: meta.format, type: IMAGE_TYPES[meta.format], width, height };
  }
  if (animated) {
    if (buffer.length > MAX_STORED) throw new HttpError(413, 'Animated pictures must be smaller than 9 MB.');
    return { buffer, format: meta.format, type: IMAGE_TYPES[meta.format], width, height };
  }
  const resized = () => sharp(buffer, { limitInputPixels: 268402689 }).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
  let format = meta.format === 'gif' ? 'png' : meta.format;
  let out;
  if (format === 'png') out = await resized().png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
  else if (format === 'webp') out = await resized().webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
  else if (format === 'avif') out = await resized().avif({ quality: 70 }).toBuffer({ resolveWithObject: true });
  else out = await resized().jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  if (out.data.length > MAX_STORED) {
    format = meta.hasAlpha ? 'webp' : 'jpeg';
    const smaller = sharp(buffer, { limitInputPixels: 268402689 }).rotate().resize({ width: 4000, height: 4000, fit: 'inside', withoutEnlargement: true });
    out = format === 'webp'
      ? await smaller.webp({ quality: 86 }).toBuffer({ resolveWithObject: true })
      : await smaller.jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  }
  return { buffer: out.data, format, type: IMAGE_TYPES[format], width: out.info.width, height: out.info.height };
}

async function uploadToCloudinary(buffer, options) {
  const cloudinary = await cld();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err || !result) {
        const msg = (err && (err.message || (err.error && err.error.message))) || 'unknown error';
        reject(new HttpError(502, explainCloudinaryError(msg)));
      } else resolve(result);
    });
    stream.end(buffer);
  });
}

// Store a picture; returns what the image fields keep ({ url, publicId, provider, width, height }).
export async function storeImage(buffer, { folder = 'misc', filename = 'image' } = {}) {
  if (!buffer || !buffer.length) throw new HttpError(400, 'The picture is empty.');
  if (buffer.length > MAX_IMAGE_UPLOAD) throw new HttpError(413, 'Pictures must be smaller than 25 MB.');
  const { problem } = cloudinarySettings();
  if (problem) throw new HttpError(503, `Pictures can't be saved until the Cloudinary settings are fixed. ${problem}`);
  const img = await prepareImage(buffer);
  const name = `${baseName(filename)}-${shortId()}`;
  const safeFolder = String(folder).replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'misc';
  if (cloudinaryEnabled()) {
    const result = await uploadToCloudinary(img.buffer, { folder: `jpk/${safeFolder}`, public_id: name, resource_type: 'image', overwrite: false });
    return { provider: 'cloudinary', url: result.secure_url || result.url, publicId: result.public_id, width: result.width || img.width, height: result.height || img.height };
  }
  const id = await gridPut(MEDIA_BUCKET, img.buffer, {
    filename: `${name}.${EXT[img.format]}`,
    contentType: img.type,
    metadata: { folder: safeFolder, width: img.width, height: img.height },
  });
  return { provider: 'db', url: `/api/files/${id}`, publicId: String(id), width: img.width, height: img.height };
}

// ---------- files kept in MongoDB (GridFS) ----------

function bucket(name) {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: name });
}

export async function gridPut(bucketName, buffer, { filename, contentType, metadata = {} }) {
  await connectDB();
  const b = bucket(bucketName);
  return new Promise((resolve, reject) => {
    const up = b.openUploadStream(filename, { metadata: { ...metadata, contentType } });
    up.once('error', reject);
    up.once('finish', () => resolve(up.id));
    up.end(buffer);
  });
}

export async function gridFind(bucketName, id) {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return null;
  const _id = new mongoose.Types.ObjectId(String(id));
  const files = await bucket(bucketName).find({ _id }).limit(1).toArray();
  return files[0] || null;
}

export function gridStream(bucketName, id) {
  return bucket(bucketName).openDownloadStream(new mongoose.Types.ObjectId(String(id)));
}

export async function gridRead(bucketName, id) {
  const chunks = [];
  for await (const chunk of gridStream(bucketName, id)) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function gridDelete(bucketName, id) {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return;
  try {
    await bucket(bucketName).delete(new mongoose.Types.ObjectId(String(id)));
  } catch (err) {
    if (!/not found|FileNotFound/i.test(String(err && err.message))) throw err;
  }
}

// ---------- CVs ----------

const RESUME_TYPES = {
  pdf: { mime: 'application/pdf', test: b => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', test: b => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 },
  doc: { mime: 'application/msword', test: b => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 },
  rtf: { mime: 'application/rtf', test: b => b.subarray(0, 5).toString('latin1') === '{\\rtf' },
};
export const MAX_RESUME = 5 * 1024 * 1024;

export async function storeResume(buffer, filename) {
  if (!buffer || !buffer.length) throw new HttpError(400, 'The CV file is empty.');
  if (buffer.length > MAX_RESUME) throw new HttpError(413, 'Your CV is larger than 5 MB. Please attach a smaller file.');
  const ext = (String(filename || '').match(/\.([a-z0-9]+)$/i) || [])[1];
  const kind = ext && RESUME_TYPES[ext.toLowerCase()];
  if (!kind) throw new HttpError(415, 'Please attach your CV as a PDF or Word file (PDF, DOC, DOCX or RTF).');
  if (!kind.test(buffer)) throw new HttpError(415, 'The CV file seems to be damaged or is not really a PDF/Word file.');
  const clean = String(filename).replace(/[^\w.\- ()]+/g, '_').slice(-120) || `cv.${ext}`;
  const fileId = await gridPut(RESUME_BUCKET, buffer, { filename: clean, contentType: kind.mime, metadata: { kind: 'resume' } });
  return { fileId, filename: clean, size: buffer.length, mimeType: kind.mime };
}

// ---------- removing pictures that are no longer used ----------

function cloudinaryPublicIdFromUrl(url) {
  const cloud = cloudinaryCloudName();
  if (!cloud) return null;
  const m = String(url).match(new RegExp(`^https?://res\\.cloudinary\\.com/${escapeRegex(cloud)}/image/upload/(?:[^/]*,[^/]*/|[a-z]_[^/]+/)*(?:v\\d+/)?(jpk/.+?)\\.[a-z0-9]+$`, 'i'));
  return m ? m[1] : null;
}

export function imageUrlsInHtml(html) {
  const urls = [];
  String(html || '').replace(/<img\b[^>]*\ssrc=["']([^"']+)["']/gi, (_, src) => urls.push(src));
  return urls;
}

// Where a stored picture is used (a post, product, category, job or the website editor), or null.
export async function imageInUse(url, publicIdHint) {
  await connectDB();
  const { Blog } = await import('../models/Blog.js');
  const { Product } = await import('../models/Product.js');
  const { ProductCategory } = await import('../models/ProductCategory.js');
  const { Job } = await import('../models/Job.js');
  const { SitePart } = await import('../models/SitePart.js');
  const dbId = (String(url).match(/\/api\/files\/([a-f0-9]{24})$/i) || [])[1];
  const publicId = publicIdHint || cloudinaryPublicIdFromUrl(url);
  const needle = dbId ? `/api/files/${dbId}` : publicId || url;
  const re = { $regex: escapeRegex(needle) };
  const [blog, product, category, job] = await Promise.all([
    Blog.exists({ $or: [{ 'coverImage.url': re }, { content: re }] }),
    Product.exists({ $or: [{ 'images.url': re }, { description: re }] }),
    ProductCategory.exists({ 'image.url': re }),
    Job.exists({ description: re }),
  ]);
  if (blog) return 'in a JPK Updates post';
  if (product) return 'in a product';
  if (category) return 'in a product category';
  if (job) return 'in a job opening';
  // the website editor keeps its changes as free-form data: look through them (there are only a few dozen)
  const parts = await SitePart.find({}).select('key json').lean();
  const hit = parts.find(p => String(p.json || '').includes(needle));
  if (hit) return hit.key === 'global' ? 'in the header or footer' : hit.key === 'settings' ? 'in the design settings' : 'on a page of the website';
  return null;
}

// Delete a stored picture when nothing (post, product, category, job, website editor) refers to it any more.
// Never throws: a picture that could not be removed is only logged.
export async function releaseImages(items) {
  const list = (Array.isArray(items) ? items : [items]).filter(Boolean).map(i => (typeof i === 'string' ? { url: i } : i));
  if (!list.length) return;
  try {
    await connectDB();
    const { Media } = await import('../models/Media.js');
    const seen = new Set();
    for (const img of list) {
      const url = img.url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const dbId = (url.match(/^\/api\/files\/([a-f0-9]{24})$/i) || [])[1];
      const publicId = img.provider === 'cloudinary' && img.publicId ? img.publicId : cloudinaryPublicIdFromUrl(url);
      if (!dbId && !publicId) continue; // not one of ours
      if (await imageInUse(url, publicId)) continue;
      // pictures uploaded for the website stay in its picture library until they are deleted there
      const media = await Media.findOne({ url }).select('folder').lean();
      if (media && media.folder === 'website') continue;
      if (dbId) await gridDelete(MEDIA_BUCKET, dbId);
      else if (cloudinaryEnabled()) await (await cld()).uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
      if (media) await Media.deleteOne({ _id: media._id });
    }
  } catch (err) {
    console.error('[jpk-admin] could not remove an unused picture:', err && err.message);
  }
}
