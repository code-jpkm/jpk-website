import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute, paged, plain } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { listParams, searchFilter, uniqueSlug } from '@/lib/validate';
import { parseBlog } from '@/lib/inputs';
import { scheduleSiteRebuild } from '@/lib/siteHook';
import { Blog } from '@/models/Blog';

export const dynamic = 'force-dynamic';

// GET /api/admin/blogs?q=&status=&page=
export const GET = adminRoute(async req => {
  await requireUser('blogs', 'view');
  const { page, limit, skip, q, sp } = listParams(req);
  const filter = { ...searchFilter(q, ['title', 'excerpt', 'slug', 'category']) };
  const status = sp.get('status');
  if (status === 'draft' || status === 'published') filter.status = status;
  await connectDB();
  const [items, total] = await Promise.all([
    Blog.find(filter).select('-content').sort({ updatedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Blog.countDocuments(filter),
  ]);
  return json(paged(plain(items), total, page, limit));
});

// POST /api/admin/blogs
export const POST = adminRoute(async req => {
  const user = await requireUser('blogs', 'create');
  const data = parseBlog(await readJson(req));
  await connectDB();
  data.slug = await uniqueSlug(Blog, data.slug || data.title);
  if (data.status === 'published' && !data.publishedAt) data.publishedAt = new Date();
  const doc = await Blog.create({ ...data, createdBy: user.id, updatedBy: user.id });
  if (doc.status === 'published') scheduleSiteRebuild('JPK Updates post published');
  return json({ item: plain(doc) }, { status: 201 });
});
