import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { websiteUrl } from '@/lib/present';
import { NoAccess } from '@/components/ui';
import WebsiteHub from '@/components/website/WebsiteHub';
import './website.css';

export const metadata = { title: 'Website' };

export default async function WebsitePage() {
  const { user, allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="the website editor" />;
  return <WebsiteHub websiteUrl={await websiteUrl()} perms={{ create: can(user, 'website', 'create'), update: can(user, 'website', 'update'), delete: can(user, 'website', 'delete') }} />;
}
