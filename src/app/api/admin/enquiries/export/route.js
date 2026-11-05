import { connectDB } from '@/lib/db';
import { adminRoute } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { listParams } from '@/lib/validate';
import { enquiryFilter } from '@/lib/inboxFilters';
import { toCsv, csvResponse, indiaTime } from '@/lib/csv';
import { websiteUrl } from '@/lib/present';
import { Enquiry } from '@/models/Enquiry';

export const dynamic = 'force-dynamic';

// GET /api/admin/enquiries/export?status=&form=&q=  -> CSV for Excel
export const GET = adminRoute(async req => {
  await requireUser('enquiries', 'view');
  const { q, sp } = listParams(req);
  await connectDB();
  const rows = await Enquiry.find(enquiryFilter(sp, q)).sort({ createdAt: -1 }).limit(10000).lean();
  const site = websiteUrl();
  const csv = toCsv(
    [
      { label: 'Received', value: r => indiaTime(r.createdAt) },
      { label: 'Name', key: 'name' },
      { label: 'Email', key: 'email' },
      { label: 'Phone', key: 'phone' },
      { label: 'Company', key: 'company' },
      { label: 'Subject', key: 'subject' },
      { label: 'Message', key: 'message' },
      { label: 'Form', key: 'formName' },
      { label: 'Page', value: r => (r.page ? `${site}${r.page}` : '') },
      { label: 'Status', key: 'status' },
      { label: 'Notes', key: 'notes' },
    ],
    rows,
  );
  return csvResponse(`jpk-enquiries-${new Date().toISOString().slice(0, 10)}.csv`, csv);
});
