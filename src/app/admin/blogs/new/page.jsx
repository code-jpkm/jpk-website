import { requirePageUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { websiteUrl } from '@/lib/present';
import { NoAccess } from '@/components/ui';
import { Blog } from '@/models/Blog';
import BlogForm from '../BlogForm';

export const metadata = { title: 'New post' };

export default async function NewBlogPage() {
  const { allowed } = await requirePageUser('blogs', 'create');
  if (!allowed) return <NoAccess what="new JPK Updates posts" />;
  await connectDB();
  const categories = (await Blog.distinct('category')).filter(Boolean);
  return <BlogForm siteUrl={websiteUrl()} categories={categories} perms={{ update: true, delete: false }} />;
}
