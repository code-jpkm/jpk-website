import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { isObjectId, uniqueSlug } from '@/lib/validate';
import { parseProduct } from '@/lib/inputs';
import { releaseImages, imageUrlsInHtml } from '@/lib/storage';
import { scheduleSiteRebuild } from '@/lib/siteHook';
import { Product } from '@/models/Product';
import { ProductCategory } from '@/models/ProductCategory';

export const dynamic = 'force-dynamic';

async function load(params) {
  const { id } = await params;
  if (!isObjectId(id)) throw new HttpError(404, 'This product does not exist.');
  await connectDB();
  const doc = await Product.findById(id);
  if (!doc) throw new HttpError(404, 'This product does not exist (it may have been deleted).');
  return doc;
}

const imagesOf = doc => [...(doc.images || []).map(i => (i.toObject ? i.toObject() : i)), ...imageUrlsInHtml(doc.description)];

export const GET = adminRoute(async (req, { params }) => {
  await requireUser('products', 'view');
  return json({ item: plain(await load(params)) });
});

export const PATCH = adminRoute(async (req, { params }) => {
  const user = await requireUser('products', 'update');
  const body = await readJson(req);
  const data = parseProduct(body, { partial: true });
  if (body.order === '' || body.order === null) delete data.order; // an emptied display order keeps the current one
  const doc = await load(params);
  if (data.category && !(await ProductCategory.exists({ _id: data.category }))) throw new HttpError(400, 'The chosen category no longer exists.');
  const wasPublished = doc.status === 'published';
  const before = imagesOf(doc);
  if ('slug' in data) data.slug = data.slug && data.slug === doc.slug ? doc.slug : await uniqueSlug(Product, data.slug || data.name || doc.name, doc._id);
  Object.assign(doc, data);
  doc.updatedBy = user.id;
  await doc.save();
  const nowUrls = new Set(imagesOf(doc).map(i => (typeof i === 'string' ? i : i.url)));
  const gone = before.filter(i => !nowUrls.has(typeof i === 'string' ? i : i.url));
  if (gone.length) releaseImages(gone);
  if (wasPublished || doc.status === 'published') scheduleSiteRebuild('product changed');
  return json({ item: plain(doc) });
});

export const DELETE = adminRoute(async (req, { params }) => {
  await requireUser('products', 'delete');
  const doc = await load(params);
  const images = imagesOf(doc);
  await doc.deleteOne();
  releaseImages(images);
  if (doc.status === 'published') scheduleSiteRebuild('product deleted');
  return json({ ok: true });
});
