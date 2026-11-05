import { connectDB } from '@/lib/db';
import { json } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { preflight } from '@/lib/cors';
import { slugify } from '@/lib/validate';
import { publicRoute, openJobsFilter } from '@/lib/publicApi';
import { publicJob, publicOrigin } from '@/lib/present';
import { Job } from '@/models/Job';

export const dynamic = 'force-dynamic';

// GET /api/public/jobs/<slug>: one open job.
export const GET = publicRoute(async (req, { params }) => {
  const { slug } = await params;
  const clean = slugify(decodeURIComponent(slug || ''), 120);
  if (!clean) throw new HttpError(404, 'Job not found.');
  await connectDB();
  const job = await Job.findOne({ $and: [openJobsFilter(), { slug: clean }] }).lean();
  if (!job) throw new HttpError(404, 'This job is no longer open.');
  return json({ item: publicJob(job, publicOrigin(req)) });
});

export function OPTIONS(req) {
  return preflight(req, 'GET, OPTIONS');
}
