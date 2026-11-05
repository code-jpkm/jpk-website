import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { isObjectId, uniqueSlug } from '@/lib/validate';
import { parseJob } from '@/lib/inputs';
import { releaseImages, imageUrlsInHtml } from '@/lib/storage';
import { scheduleSiteRebuild } from '@/lib/siteHook';
import { Job } from '@/models/Job';
import { Application } from '@/models/Application';

export const dynamic = 'force-dynamic';

async function load(params) {
  const { id } = await params;
  if (!isObjectId(id)) throw new HttpError(404, 'This job does not exist.');
  await connectDB();
  const doc = await Job.findById(id);
  if (!doc) throw new HttpError(404, 'This job does not exist (it may have been deleted).');
  return doc;
}

export const GET = adminRoute(async (req, { params }) => {
  await requireUser('jobs', 'view');
  return json({ item: plain(await load(params)) });
});

export const PATCH = adminRoute(async (req, { params }) => {
  const user = await requireUser('jobs', 'update');
  const data = parseJob(await readJson(req), { partial: true });
  const doc = await load(params);
  const wasPublished = doc.status === 'published';
  const inlineBefore = imageUrlsInHtml(doc.description);
  if ('slug' in data) data.slug = data.slug && data.slug === doc.slug ? doc.slug : await uniqueSlug(Job, data.slug || data.title || doc.title, doc._id);
  Object.assign(doc, data);
  if (doc.status === 'published' && !doc.publishedAt) doc.publishedAt = new Date();
  doc.updatedBy = user.id;
  await doc.save();
  const gone = inlineBefore.filter(u => !doc.description.includes(u));
  if (gone.length) releaseImages(gone);
  if (wasPublished || doc.status === 'published') scheduleSiteRebuild('job changed');
  return json({ item: plain(doc) });
});

// Deleting a job keeps its applications (they show the job title they were sent for).
export const DELETE = adminRoute(async (req, { params }) => {
  await requireUser('jobs', 'delete');
  const doc = await load(params);
  await Application.updateMany({ job: doc._id }, { $set: { job: null, jobTitle: doc.title } });
  const inline = imageUrlsInHtml(doc.description);
  await doc.deleteOne();
  if (inline.length) releaseImages(inline);
  if (doc.status === 'published') scheduleSiteRebuild('job deleted');
  return json({ ok: true });
});
