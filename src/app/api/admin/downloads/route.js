import { connectDB } from '@/lib/db';
import { json, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { storeDownload, gridDelete, DOWNLOAD_BUCKET, MAX_DOWNLOAD } from '@/lib/storage';
import { downloadFields } from '@/lib/downloads';
import { scheduleSiteRebuild } from '@/lib/siteHook';
import { Download } from '@/models/Download';

export const dynamic = 'force-dynamic';

// GET /api/admin/downloads -> { items }
export const GET = adminRoute(async () => {
  await requireUser('website', 'view');
  await connectDB();
  const items = await Download.find({}).sort({ category: 1, order: 1, createdAt: 1 }).lean();
  return json({ items: plain(items) });
});

// POST /api/admin/downloads (multipart: file, title, category, description, published) -> { item }
export const POST = adminRoute(async req => {
  const user = await requireUser('website', 'create');
  if (Number(req.headers.get('content-length') || 0) > MAX_DOWNLOAD + 512 * 1024) throw new HttpError(413, 'The PDF is larger than 20 MB. Please make it smaller and try again.');
  let form;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, 'The file could not be read. Please try again.');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size) throw new HttpError(400, 'Please choose a PDF file.');
  const fields = downloadFields(form);
  const stored = await storeDownload(Buffer.from(await file.arrayBuffer()), file.name);
  await connectDB();
  try {
    const doc = await Download.create({ ...fields, ...stored, published: fields.published !== false, createdBy: user.id, updatedBy: user.id });
    scheduleSiteRebuild('downloads');
    return json({ item: plain(doc.toObject()) }, { status: 201 });
  } catch (err) {
    await gridDelete(DOWNLOAD_BUCKET, stored.fileId).catch(() => {});
    throw err;
  }
});
