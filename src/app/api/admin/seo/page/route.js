import { json, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { seoPage } from '@/lib/seo/content';

export const dynamic = 'force-dynamic';

// GET /api/admin/seo/page?key=page:AboutUs | custom:<id> -> the page's texts, pictures and links for the SEO
// check, its search engine settings and its saved data (the SEO editor saves through /api/admin/site/part)
export const GET = adminRoute(async req => {
  await requireUser('website', 'view');
  const key = String(new URL(req.url).searchParams.get('key') || '');
  if (!/^page:[A-Za-z0-9]{1,60}$/.test(key) && !/^custom:[a-z0-9]{6,30}$/.test(key)) throw new HttpError(404, 'This page does not exist.');
  const page = await seoPage(key);
  if (!page) throw new HttpError(404, 'This page does not exist (any more).');
  return json({ page: plain(page) });
});
