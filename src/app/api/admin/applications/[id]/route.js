import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { isObjectId, oneOf, text } from '@/lib/validate';
import { gridDelete, RESUME_BUCKET } from '@/lib/storage';
import { Application, APPLICATION_STATUSES } from '@/models/Application';

export const dynamic = 'force-dynamic';

async function load(params) {
  const { id } = await params;
  if (!isObjectId(id)) throw new HttpError(404, 'This application does not exist.');
  await connectDB();
  const doc = await Application.findById(id);
  if (!doc) throw new HttpError(404, 'This application does not exist (it may have been deleted).');
  return doc;
}

export const GET = adminRoute(async (req, { params }) => {
  await requireUser('applications', 'view');
  return json({ item: plain(await load(params)) });
});

// PATCH { status?, notes? }
export const PATCH = adminRoute(async (req, { params }) => {
  await requireUser('applications', 'update');
  const body = await readJson(req, { maxBytes: 50_000 });
  const doc = await load(params);
  if ('status' in body) doc.status = oneOf(body.status, APPLICATION_STATUSES, doc.status);
  if ('notes' in body) doc.notes = text(body.notes, { max: 6000, label: 'Notes' });
  await doc.save();
  return json({ item: plain(doc) });
});

export const DELETE = adminRoute(async (req, { params }) => {
  await requireUser('applications', 'delete');
  const doc = await load(params);
  const fileId = doc.resume && doc.resume.fileId;
  await doc.deleteOne();
  if (fileId) await gridDelete(RESUME_BUCKET, fileId).catch(err => console.error('[jpk-admin] CV not removed:', err.message));
  return json({ ok: true });
});
