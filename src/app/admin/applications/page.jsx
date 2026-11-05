import { requirePageUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { NoAccess } from '@/components/ui';
import { Job } from '@/models/Job';
import { APPLICATION_STATUSES } from '@/models/Application';
import ApplicationList from './ApplicationList';

export const metadata = { title: 'Job applications' };

export default async function ApplicationsPage({ searchParams }) {
  const { user, allowed } = await requirePageUser('applications');
  if (!allowed) return <NoAccess what="job applications" />;
  await connectDB();
  const jobs = await Job.find({}).select('title status').sort({ createdAt: -1 }).limit(300).lean();
  const sp = (await searchParams) || {};
  const initial = {
    status: APPLICATION_STATUSES.includes(sp.status) ? sp.status : '',
    job: typeof sp.job === 'string' && (sp.job === 'general' || jobs.some(j => String(j._id) === sp.job)) ? sp.job : '',
  };
  const perms = { update: can(user, 'applications', 'update'), delete: can(user, 'applications', 'delete') };
  return <ApplicationList key={`${initial.status}|${initial.job}`} jobs={plain(jobs)} initial={initial} perms={perms} />;
}
