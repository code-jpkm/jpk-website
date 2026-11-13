import { connectDB } from '@/lib/db';
import { json, adminRoute, plain, readJson } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { isObjectId } from '@/lib/validate';
import { storeDownload, gridDelete, DOWNLOAD_BUCKET } from '@/lib/storage';
import { downloadFields } from '@/lib/downloads';
import { scheduleSiteRebuild } from '@/lib/siteHook';
import { Download } from '@/models/Download';

export const dynamic = 'force-dynamic';

async function find(params) {
  const { id } = await params;
  if (!isObjectId(id)) throw new HttpError(404, 'This file was not found.');
  await connectDB();
  const doc = await Download.findById(id);
  if (!doc) throw new HttpError(404, 'This file was not found. It may have been deleted.');
  return doc;
}

// PATCH: JSON { title?, category?, description?, published?, order? }, or multipart with a new file to replace it
export const PATCH = adminRoute(async (req, ctx) => {
  const user = await requireUser('website', 'update');
  const doc = await find(ctx.params);
  const multipart = String(req.headers.get('content-type') || '').includes('multipart/form-data');
  const body = multipart ? await req.formData() : await readJson(req, { maxBytes: 20000 });
  Object.assign(doc, downloadFields(body, { partial: true }));
  let oldFile = null;
  if (multipart) {
    const file = body.get('file');
    if (file && typeof file !== 'string' && file.size) {
      const stored = await storeDownload(Buffer.from(await file.arrayBuffer()), file.name);
      oldFile = doc.fileId;
      Object.assign(doc, stored);
    }
  }
  doc.updatedBy = user.id;
  await doc.save();
  if (oldFile) await gridDelete(DOWNLOAD_BUCKET, oldFile).catch(() => {});
  scheduleSiteRebuild('downloads');
  return json({ item: plain(doc.toObject()) });
});

export const DELETE = adminRoute(async (req, ctx) => {
  await requireUser('website', 'delete');
  const doc = await find(ctx.params);
  await doc.deleteOne();
  await gridDelete(DOWNLOAD_BUCKET, doc.fileId).catch(() => {});
  scheduleSiteRebuild('downloads');
  return json({ ok: true });
});
