import { connectDB } from '@/lib/db';
import { adminRoute } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { listParams } from '@/lib/validate';
import { applicationFilter } from '@/lib/inboxFilters';
import { toCsv, csvResponse, indiaTime } from '@/lib/csv';
import { Application } from '@/models/Application';

export const dynamic = 'force-dynamic';

// GET /api/admin/applications/export?status=&job=&q=  -> CSV for Excel
export const GET = adminRoute(async req => {
  await requireUser('applications', 'view');
  const { q, sp } = listParams(req);
  await connectDB();
  const rows = await Application.find(applicationFilter(sp, q)).sort({ createdAt: -1 }).limit(10000).lean();
  const csv = toCsv(
    [
      { label: 'Received', value: r => indiaTime(r.createdAt) },
      { label: 'Position', key: 'jobTitle' },
      { label: 'Name', key: 'name' },
      { label: 'Email', key: 'email' },
      { label: 'Phone', key: 'phone' },
      { label: 'Location', key: 'location' },
      { label: 'Experience', key: 'experience' },
      { label: 'Current company', key: 'currentCompany' },
      { label: 'LinkedIn', key: 'linkedin' },
      { label: 'Status', key: 'status' },
      { label: 'Cover letter', key: 'coverLetter' },
      { label: 'Notes', key: 'notes' },
    ],
    rows,
  );
  return csvResponse(`jpk-applications-${new Date().toISOString().slice(0, 10)}.csv`, csv);
});
