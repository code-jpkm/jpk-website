import { json, readJson, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { linksOverview, pageLinks, findPlaces, changeLink } from '@/lib/seo/links';

export const dynamic = 'force-dynamic';

const validKey = k => /^page:[A-Za-z0-9]{1,60}$/.test(k) || /^custom:[a-z0-9]{6,30}$/.test(k) || /^post:[a-f0-9]{24}$/.test(k) || k === 'global';

// GET /api/admin/seo/links                 -> { rows, global }: the links of every page (counts)
// GET /api/admin/seo/links?key=page:AboutUs -> { page }: its links, the pages linking to it, link suggestions
// GET /api/admin/seo/links?key=…&find=words -> { places }: where the words are on the page (to make them a link)
export const GET = adminRoute(async req => {
  await requireUser('website', 'view');
  const sp = new URL(req.url).searchParams;
  const key = String(sp.get('key') || '');
  if (!key) {
    const { rows, global } = await linksOverview();
    return json({ rows, global });
  }
  if (!validKey(key)) throw new HttpError(404, 'This page does not exist.');
  if (sp.has('find')) {
    const words = String(sp.get('find') || '').trim().slice(0, 120);
    if (!words) return json({ places: [] });
    const places = await findPlaces(key, words);
    if (!places) throw new HttpError(404, 'This page does not exist (any more).');
    return json({ places });
  }
  const page = await pageLinks(key);
  if (!page) throw new HttpError(404, 'This page does not exist (any more).');
  return json({ page: plain(page) });
});

// POST /api/admin/seo/links  { key, op: 'edit' | 'unlink' | 'add', … } -> { page } (the page's links after the change)
export const POST = adminRoute(async req => {
  const body = await readJson(req);
  const key = String((body && body.key) || '');
  if (!validKey(key)) throw new HttpError(404, 'This page does not exist.');
  const user = await requireUser(key.startsWith('post:') ? 'blogs' : 'website', 'update');
  await changeLink(key, body, user);
  const page = await pageLinks(key);
  return json({ page: plain(page) });
});
