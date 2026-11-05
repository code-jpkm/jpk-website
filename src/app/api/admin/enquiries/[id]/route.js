import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { isObjectId, oneOf, text } from '@/lib/validate';
import { Enquiry, ENQUIRY_STATUSES } from '@/models/Enquiry';

export const dynamic = 'force-dynamic';

async function load(params) {
  const { id } = await params;
  if (!isObjectId(id)) throw new HttpError(404, 'This enquiry does not exist.');
  await connectDB();
  const doc = await Enquiry.findById(id);
  if (!doc) throw new HttpError(404, 'This enquiry does not exist (it may have been deleted).');
  return doc;
}

export const GET = adminRoute(async (req, { params }) => {
  await requireUser('enquiries', 'view');
  return json({ item: plain(await load(params)) });
});

// PATCH { status?, notes? }
export const PATCH = adminRoute(async (req, { params }) => {
  await requireUser('enquiries', 'update');
  const body = await readJson(req, { maxBytes: 50_000 });
  const doc = await load(params);
  if ('status' in body) doc.status = oneOf(body.status, ENQUIRY_STATUSES, doc.status);
  if ('notes' in body) doc.notes = text(body.notes, { max: 6000, label: 'Notes' });
  await doc.save();
  return json({ item: plain(doc) });
});

export const DELETE = adminRoute(async (req, { params }) => {
  await requireUser('enquiries', 'delete');
  const doc = await load(params);
  await doc.deleteOne();
  return json({ ok: true });
});
