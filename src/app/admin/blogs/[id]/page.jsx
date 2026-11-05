import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { isObjectId } from '@/lib/validate';
import { websiteUrl } from '@/lib/present';
import { NoAccess } from '@/components/ui';
import { Blog } from '@/models/Blog';
import BlogForm from '../BlogForm';

export const metadata = { title: 'Edit post' };

export default async function EditBlogPage({ params }) {
  const { user, allowed } = await requirePageUser('blogs');
  if (!allowed) return <NoAccess what="JPK Updates" />;
  const { id } = await params;
  if (!isObjectId(id)) notFound();
  await connectDB();
  const [post, categories] = await Promise.all([Blog.findById(id).lean(), Blog.distinct('category')]);
  if (!post) notFound();
  return (
    <BlogForm
      key={String(post._id)}
      initial={plain(post)}
      siteUrl={websiteUrl()}
      categories={categories.filter(Boolean)}
      perms={{ update: can(user, 'blogs', 'update'), delete: can(user, 'blogs', 'delete') }}
    />
  );
}
