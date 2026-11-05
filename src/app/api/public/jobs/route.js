import { connectDB } from '@/lib/db';
import { json } from '@/lib/http';
import { preflight } from '@/lib/cors';
import { publicRoute, openJobsFilter } from '@/lib/publicApi';
import { publicJob, publicOrigin } from '@/lib/present';
import { Job } from '@/models/Job';

export const dynamic = 'force-dynamic';

// GET /api/public/jobs: open job openings for the Careers page (published and not past the closing date).
export const GET = publicRoute(async req => {
  await connectDB();
  const jobs = await Job.find(openJobsFilter()).sort({ publishedAt: -1, _id: -1 }).limit(200).lean();
  const origin = publicOrigin(req);
  return json({ items: jobs.map(j => publicJob(j, origin)), total: jobs.length });
});

export function OPTIONS(req) {
  return preflight(req, 'GET, OPTIONS');
}
