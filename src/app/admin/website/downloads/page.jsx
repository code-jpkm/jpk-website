import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { websiteUrl } from '@/lib/present';
import { NoAccess } from '@/components/ui';
import DownloadsManager from '@/components/website/DownloadsManager';
import '../website.css';

export const metadata = { title: 'Downloads' };
export const dynamic = 'force-dynamic';

export default async function DownloadsPage() {
  const { user, allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="the website editor" />;
  return (
    <DownloadsManager
      websiteUrl={await websiteUrl()}
      perms={{ create: can(user, 'website', 'create'), update: can(user, 'website', 'update'), delete: can(user, 'website', 'delete') }}
    />
  );
}
