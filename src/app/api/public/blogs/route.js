import { connectDB } from '@/lib/db';
import { json, paged } from '@/lib/http';
import { preflight } from '@/lib/cors';
import { listParams, searchFilter } from '@/lib/validate';
import { publicRoute, publishedPostsFilter } from '@/lib/publicApi';
import { publicBlog, publicOrigin } from '@/lib/present';
import { Blog } from '@/models/Blog';
import { getSetting } from '@/models/Setting';

export const dynamic = 'force-dynamic';

// GET /api/public/blogs?limit=60&page=1&q=&category=&fields=summary
// Published JPK Updates posts, newest first. "fields=summary" leaves out the article text.
// "imported": the six posts from WordPress have been set up here, so an empty list really means no posts
// (the website then stops showing its own copies).
export const GET = publicRoute(async req => {
  const { page, limit, skip, q, sp } = listParams(req, { maxLimit: 100, defaultLimit: 20 });
  const filters = [publishedPostsFilter()];
  if (q) filters.push(searchFilter(q, ['title', 'excerpt', 'tags']));
  if (sp.get('category')) filters.push({ category: sp.get('category') });
  const filter = filters.length > 1 ? { $and: filters } : filters[0];
  await connectDB();
  const [items, total, imported] = await Promise.all([
    Blog.find(filter).sort({ publishedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Blog.countDocuments(filter),
    getSetting('seed.jpkUpdates'),
  ]);
  const origin = publicOrigin(req);
  const withContent = sp.get('fields') !== 'summary';
  return json({ ...paged(items.map(b => publicBlog(b, origin, { withContent })), total, page, limit), imported: Boolean(imported) });
});

export function OPTIONS(req) {
  return preflight(req, 'GET, OPTIONS');
}
