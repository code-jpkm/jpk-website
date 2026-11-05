import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { websiteUrl } from '@/lib/present';
import { NoAccess } from '@/components/ui';
import BlogList from './BlogList';

export const metadata = { title: 'JPK Updates' };

export default async function BlogsPage() {
  const { user, allowed } = await requirePageUser('blogs');
  if (!allowed) return <NoAccess what="JPK Updates" />;
  const perms = { create: can(user, 'blogs', 'create'), update: can(user, 'blogs', 'update'), delete: can(user, 'blogs', 'delete') };
  return <BlogList perms={perms} siteUrl={websiteUrl()} />;
}
