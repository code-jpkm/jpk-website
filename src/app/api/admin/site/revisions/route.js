import { json, readJson, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { isObjectId } from '@/lib/validate';
import { revisions, restoreRevision, partKind } from '@/lib/site/store';

export const dynamic = 'force-dynamic';

// GET /api/admin/site/revisions?key=… -> earlier versions (newest first)
export const GET = adminRoute(async req => {
  await requireUser('website', 'view');
  const key = new URL(req.url).searchParams.get('key') || '';
  if (!partKind(key)) throw new HttpError(404, 'This part of the website does not exist.');
  return json({ items: plain(await revisions(key)) });
});

// POST /api/admin/site/revisions { key, id } -> that version becomes the current one (the current one is kept too)
export const POST = adminRoute(async req => {
  const user = await requireUser('website', 'update');
  const { key, id } = await readJson(req);
  if (!partKind(key) || !isObjectId(id)) throw new HttpError(400, 'This earlier version could not be found.');
  const doc = await restoreRevision(key, id, user);
  return json({ data: plain(doc.data), updatedAt: doc.updatedAt, updatedByName: doc.updatedByName });
});
