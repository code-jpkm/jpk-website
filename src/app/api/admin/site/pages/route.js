import { json, readJson, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { getSchema } from '@/lib/site/schema';
import { createCustomPage, customPages, customPaths } from '@/lib/site/store';
import { cleanPath, pathProblem } from '@/lib/site/clean';
import { SitePart, partData } from '@/models/SitePart';

export const dynamic = 'force-dynamic';

// GET /api/admin/site/pages -> the website's pages with what was changed, the pages made in the admin, and when the
// header/footer, menu and design were last changed
export const GET = adminRoute(async () => {
  await requireUser('website', 'view');
  const { schema, source } = await getSchema();
  await connectDB();
  const parts = await SitePart.find({ kind: { $ne: 'custom' } }).lean();
  const byKey = Object.fromEntries(parts.map(p => [p.key, p]));
  const pages = schema.pages.map(p => {
    const part = byKey[`page:${p.page}`];
    const d = partData(part) || {};
    const changed = Object.keys(d.content || {}).length + (Array.isArray(d.sections) && d.sections.length ? 1 : 0) + (d.seo && Object.keys(d.seo).length ? 1 : 0);
    return { page: p.page, name: p.name, path: p.path, items: Object.keys(p.fields).length, sections: p.sections.length, changed, hidden: Boolean(d.hidden), updatedAt: part ? part.updatedAt : null, updatedByName: part ? part.updatedByName : '' };
  });
  const custom = await customPages();
  const meta = k => (byKey[k] ? { updatedAt: byKey[k].updatedAt, updatedByName: byKey[k].updatedByName } : null);
  return json({ pages, custom: plain(custom), global: meta('global'), menus: meta('menus'), settings: meta('settings'), source, builtAt: schema.builtAt || null });
});

// POST /api/admin/site/pages { title, path, template } -> a new page (not published yet)
export const POST = adminRoute(async req => {
  const user = await requireUser('website', 'create');
  const body = await readJson(req);
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
  if (!title) throw new HttpError(400, 'Please give the page a name.');
  const path = cleanPath(body.path || title);
  const { schema } = await getSchema();
  const problem = pathProblem(path, { takenBy: [...schema.pages.map(p => p.path), ...(await customPaths())] });
  if (problem) throw new HttpError(400, problem);
  const { id } = await createCustomPage({ title, path, template: body.template }, user);
  return json({ id, path }, { status: 201 });
});
