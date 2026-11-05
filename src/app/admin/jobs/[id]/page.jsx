import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { isObjectId } from '@/lib/validate';
import { websiteUrl } from '@/lib/present';
import { NoAccess } from '@/components/ui';
import { Job } from '@/models/Job';
import { Application } from '@/models/Application';
import JobForm from '../JobForm';

export const metadata = { title: 'Edit job' };

export default async function EditJobPage({ params }) {
  const { user, allowed } = await requirePageUser('jobs');
  if (!allowed) return <NoAccess what="job openings" />;
  const { id } = await params;
  if (!isObjectId(id)) notFound();
  await connectDB();
  const [job, departments, locations, applications] = await Promise.all([
    Job.findById(id).lean(),
    Job.distinct('department'),
    Job.distinct('location'),
    Application.countDocuments({ job: id }),
  ]);
  if (!job) notFound();
  return (
    <JobForm
      key={String(job._id)}
      initial={plain(job)}
      applications={applications}
      siteUrl={websiteUrl()}
      departments={departments.filter(Boolean)}
      locations={locations.filter(Boolean)}
      perms={{ update: can(user, 'jobs', 'update'), delete: can(user, 'jobs', 'delete'), applications: can(user, 'applications', 'view') }}
    />
  );
}
