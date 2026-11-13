import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { websiteUrl } from '@/lib/present';
import { NoAccess } from '@/components/ui';
import JobList from './JobList';

export const metadata = { title: 'Job openings' };

export default async function JobsPage() {
  const { user, allowed } = await requirePageUser('jobs');
  if (!allowed) return <NoAccess what="job openings" />;
  const perms = {
    create: can(user, 'jobs', 'create'),
    update: can(user, 'jobs', 'update'),
    delete: can(user, 'jobs', 'delete'),
    applications: can(user, 'applications', 'view'),
  };
  return <JobList perms={perms} siteUrl={await websiteUrl()} />;
}
