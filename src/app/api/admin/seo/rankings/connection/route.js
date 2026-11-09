import { json, readJson, adminRoute } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { saveGsc, deleteGsc, gscStatus } from '@/lib/analytics/gsc';

export const dynamic = 'force-dynamic';

// GET -> the connection (no secrets); PUT { siteUrl, useGa } or { siteUrl, key: "<service account JSON>" } -> tried,
// then saved; DELETE -> disconnected
export const GET = adminRoute(async () => {
  await requireUser('website', 'view');
  return json({ status: await gscStatus() });
});

export const PUT = adminRoute(async req => {
  await requireUser('website', 'update');
  const body = await readJson(req, { maxBytes: 100_000 });
  return json({ status: await saveGsc({ siteUrl: body.siteUrl, key: body.key, useGa: Boolean(body.useGa) }) });
});

export const DELETE = adminRoute(async () => {
  await requireUser('website', 'update');
  await deleteGsc();
  return json({ status: await gscStatus() });
});
