import { json, readJson, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { getPart, savePart, deletePart, partKind } from '@/lib/site/store';

export const dynamic = 'force-dynamic';

const keyOf = req => {
  const key = new URL(req.url).searchParams.get('key') || '';
  if (!partKind(key)) throw new HttpError(404, 'This part of the website does not exist.');
  return key;
};
const present = doc => (doc ? { data: plain(doc.data || {}), updatedAt: doc.updatedAt, updatedByName: doc.updatedByName || '' } : { data: null, updatedAt: null, updatedByName: '' });

// GET /api/admin/site/part?key=page:AboutUs | global | custom:<id> | menus | settings
export const GET = adminRoute(async req => {
  await requireUser('website', 'view');
  return json(present(await getPart(keyOf(req))));
});

// PUT /api/admin/site/part?key=…  { data, updatedAt } -> saved (live on the website at once)
export const PUT = adminRoute(async req => {
  const key = keyOf(req);
  const user = await requireUser('website', 'update');
  const body = await readJson(req, { maxBytes: 6_000_000 });
  // someone else saved this part after it was opened here: don't overwrite their work without asking
  if (body.updatedAt !== undefined && !body.force) {
    const current = await getPart(key);
    const was = body.updatedAt ? new Date(body.updatedAt).getTime() : 0;
    const now = current && current.updatedAt ? new Date(current.updatedAt).getTime() : 0;
    if (now && now !== was) throw new HttpError(409, `${current.updatedByName || 'Someone'} saved changes to this page after you opened it. Reload the page to see them, or save again to replace them.`);
  }
  const doc = await savePart(key, body.data, user);
  return json(present(doc));
});

// DELETE /api/admin/site/part?key=custom:<id>  (pages made in the admin), or any other key: undo all changes
export const DELETE = adminRoute(async req => {
  const key = keyOf(req);
  const user = await requireUser('website', partKind(key) === 'custom' ? 'delete' : 'update');
  await deletePart(key, user);
  return json({ ok: true });
});
