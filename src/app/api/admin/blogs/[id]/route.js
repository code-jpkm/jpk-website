import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { isObjectId, uniqueSlug } from '@/lib/validate';
import { parseBlog } from '@/lib/inputs';
import { releaseImages, imageUrlsInHtml } from '@/lib/storage';
import { scheduleSiteRebuild } from '@/lib/siteHook';
import { Blog } from '@/models/Blog';

export const dynamic = 'force-dynamic';

async function load(params) {
  const { id } = await params;
  if (!isObjectId(id)) throw new HttpError(404, 'This post does not exist.');
  await connectDB();
  const doc = await Blog.findById(id);
  if (!doc) throw new HttpError(404, 'This post does not exist (it may have been deleted).');
  return doc;
}

export const GET = adminRoute(async (req, { params }) => {
  await requireUser('blogs', 'view');
  return json({ item: plain(await load(params)) });
});

export const PATCH = adminRoute(async (req, { params }) => {
  const user = await requireUser('blogs', 'update');
  const data = parseBlog(await readJson(req), { partial: true });
  const doc = await load(params);
  const wasPublished = doc.status === 'published';
  const before = { cover: doc.coverImage ? doc.coverImage.toObject() : null, inline: imageUrlsInHtml(doc.content) };
  if ('slug' in data) data.slug = data.slug && data.slug === doc.slug ? doc.slug : await uniqueSlug(Blog, data.slug || data.title || doc.title, doc._id);
  Object.assign(doc, data);
  if (doc.status === 'published' && !doc.publishedAt) doc.publishedAt = new Date();
  doc.updatedBy = user.id;
  await doc.save();
  const gone = [];
  if (before.cover && (!doc.coverImage || doc.coverImage.url !== before.cover.url)) gone.push(before.cover);
  for (const url of before.inline) if (!doc.content.includes(url)) gone.push(url);
  if (gone.length) releaseImages(gone);
  if (wasPublished || doc.status === 'published') scheduleSiteRebuild('JPK Updates post changed');
  return json({ item: plain(doc) });
});

export const DELETE = adminRoute(async (req, { params }) => {
  await requireUser('blogs', 'delete');
  const doc = await load(params);
  const images = [doc.coverImage ? doc.coverImage.toObject() : null, ...imageUrlsInHtml(doc.content)];
  await doc.deleteOne();
  releaseImages(images);
  if (doc.status === 'published') scheduleSiteRebuild('JPK Updates post deleted');
  return json({ ok: true });
});
