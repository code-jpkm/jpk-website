import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute, paged, plain } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { listParams, searchFilter, uniqueSlug } from '@/lib/validate';
import { parseJob } from '@/lib/inputs';
import { scheduleSiteRebuild } from '@/lib/siteHook';
import { Job } from '@/models/Job';
import { Application } from '@/models/Application';

export const dynamic = 'force-dynamic';

// GET /api/admin/jobs?q=&status=&page=  (with the number of applications per job)
export const GET = adminRoute(async req => {
  await requireUser('jobs', 'view');
  const { page, limit, skip, q, sp } = listParams(req);
  const filter = { ...searchFilter(q, ['title', 'department', 'location', 'slug']) };
  const status = sp.get('status');
  if (['draft', 'published', 'closed'].includes(status)) filter.status = status;
  await connectDB();
  const [items, total] = await Promise.all([
    Job.find(filter).select('-description').sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Job.countDocuments(filter),
  ]);
  const ids = items.map(j => j._id);
  const group = { $group: { _id: '$job', count: { $sum: 1 } } };
  const [all, fresh] = ids.length
    ? await Promise.all([
      Application.aggregate([{ $match: { job: { $in: ids } } }, group]),
      Application.aggregate([{ $match: { job: { $in: ids }, status: 'new' } }, group]),
    ])
    : [[], []];
  const allMap = new Map(all.map(c => [String(c._id), c.count]));
  const freshMap = new Map(fresh.map(c => [String(c._id), c.count]));
  const withCounts = items.map(j => ({ ...j, applications: allMap.get(String(j._id)) || 0, newApplications: freshMap.get(String(j._id)) || 0 }));
  return json(paged(plain(withCounts), total, page, limit));
});

// POST /api/admin/jobs
export const POST = adminRoute(async req => {
  const user = await requireUser('jobs', 'create');
  const data = parseJob(await readJson(req));
  await connectDB();
  data.slug = await uniqueSlug(Job, data.slug || data.title);
  if (data.status === 'published' && !data.publishedAt) data.publishedAt = new Date();
  const doc = await Job.create({ ...data, createdBy: user.id, updatedBy: user.id });
  if (doc.status === 'published') scheduleSiteRebuild('job published');
  return json({ item: plain(doc) }, { status: 201 });
});
