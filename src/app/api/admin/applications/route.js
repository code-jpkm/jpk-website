import { connectDB } from '@/lib/db';
import { json, adminRoute, paged, plain } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { listParams } from '@/lib/validate';
import { applicationFilter } from '@/lib/inboxFilters';
import { Application } from '@/models/Application';

export const dynamic = 'force-dynamic';

// GET /api/admin/applications?q=&status=&job=<id|general>&page=
export const GET = adminRoute(async req => {
  await requireUser('applications', 'view');
  const { page, limit, skip, q, sp } = listParams(req);
  const filter = applicationFilter(sp, q);
  await connectDB();
  const [items, total] = await Promise.all([
    Application.find(filter).select('-coverLetter -notes -userAgent').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Application.countDocuments(filter),
  ]);
  return json(paged(plain(items), total, page, limit));
});
