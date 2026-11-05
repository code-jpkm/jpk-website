import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { isObjectId } from '@/lib/validate';
import { NoAccess } from '@/components/ui';
import { Application } from '@/models/Application';
import ApplicationDetail from './ApplicationDetail';

export const metadata = { title: 'Job application' };

export default async function ApplicationPage({ params }) {
  const { user, allowed } = await requirePageUser('applications');
  if (!allowed) return <NoAccess what="job applications" />;
  const { id } = await params;
  if (!isObjectId(id)) notFound();
  await connectDB();
  const app = await Application.findById(id).populate('job', 'title status').lean();
  if (!app) notFound();
  return <ApplicationDetail key={String(app._id)} initial={plain(app)} perms={{ update: can(user, 'applications', 'update'), delete: can(user, 'applications', 'delete'), jobs: can(user, 'jobs', 'view') }} />;
}
