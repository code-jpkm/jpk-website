import { connectDB } from '@/lib/db';
import { json, adminRoute, paged, plain } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { listParams } from '@/lib/validate';
import { enquiryFilter } from '@/lib/inboxFilters';
import { Enquiry } from '@/models/Enquiry';

export const dynamic = 'force-dynamic';

// GET /api/admin/enquiries?q=&status=&form=&page=
export const GET = adminRoute(async req => {
  await requireUser('enquiries', 'view');
  const { page, limit, skip, q, sp } = listParams(req);
  const filter = enquiryFilter(sp, q);
  await connectDB();
  const [items, total] = await Promise.all([
    Enquiry.find(filter).select('-notes -userAgent').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Enquiry.countDocuments(filter),
  ]);
  return json(paged(plain(items), total, page, limit));
});
