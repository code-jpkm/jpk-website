import { requirePageUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { websiteUrl } from '@/lib/present';
import { NoAccess } from '@/components/ui';
import { Job } from '@/models/Job';
import JobForm from '../JobForm';

export const metadata = { title: 'New job' };

export default async function NewJobPage() {
  const { allowed } = await requirePageUser('jobs', 'create');
  if (!allowed) return <NoAccess what="new job openings" />;
  await connectDB();
  const [departments, locations] = await Promise.all([Job.distinct('department'), Job.distinct('location')]);
  return <JobForm siteUrl={await websiteUrl()} departments={departments.filter(Boolean)} locations={locations.filter(Boolean)} perms={{ update: true, delete: false }} />;
}
