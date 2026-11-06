import { connectDB } from '@/lib/db';
import { json, adminRoute, paged, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { canUpload } from '@/lib/permissions';
import { listParams, escapeRegex } from '@/lib/validate';
import { Media } from '@/models/Media';

export const dynamic = 'force-dynamic';

// GET /api/admin/media?q=&folder=&page= -> the picture library (newest first)
export const GET = adminRoute(async req => {
  const user = await requireUser();
  if (!canUpload(user)) throw new HttpError(403, 'You do not have permission to use the picture library.');
  const { page, limit, skip, q, sp } = listParams(req, { defaultLimit: 40, maxLimit: 100 });
  await connectDB();
  const filter = {};
  if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };
  const folder = sp.get('folder');
  if (folder && /^[a-z-]{2,30}$/.test(folder)) filter.folder = folder;
  const [items, total] = await Promise.all([
    Media.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Media.countDocuments(filter),
  ]);
  return json(paged(plain(items), total, page, limit));
});
