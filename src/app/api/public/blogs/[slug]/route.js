import { connectDB } from '@/lib/db';
import { json } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { preflight } from '@/lib/cors';
import { slugify } from '@/lib/validate';
import { publicRoute, publishedPostsFilter } from '@/lib/publicApi';
import { publicBlog, publicOrigin } from '@/lib/present';
import { Blog } from '@/models/Blog';

export const dynamic = 'force-dynamic';

// GET /api/public/blogs/<slug>: one published post with its full text.
export const GET = publicRoute(async (req, { params }) => {
  const { slug } = await params;
  const clean = slugify(decodeURIComponent(slug || ''), 120);
  if (!clean) throw new HttpError(404, 'Post not found.');
  await connectDB();
  const post = await Blog.findOne({ ...publishedPostsFilter(), slug: clean }).lean();
  if (!post) throw new HttpError(404, 'Post not found.');
  return json({ item: publicBlog(post, publicOrigin(req)) });
});

export function OPTIONS(req) {
  return preflight(req, 'GET, OPTIONS');
}
