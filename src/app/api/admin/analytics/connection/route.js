import { json, readJson, adminRoute } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { saveConnection, deleteConnection, connectionStatus } from '@/lib/analytics/ga4';

export const dynamic = 'force-dynamic';

// GET -> the connection (no secrets); PUT { propertyId, key: "<service account JSON>" } -> tried, then saved;
// DELETE -> disconnected (the reports disappear from the admin; visitors keep being counted on the website)
export const GET = adminRoute(async () => {
  await requireUser('website', 'view');
  return json({ status: await connectionStatus() });
});

export const PUT = adminRoute(async req => {
  await requireUser('website', 'update');
  const body = await readJson(req, { maxBytes: 100_000 });
  return json({ status: await saveConnection({ propertyId: body.propertyId, key: body.key }) });
});

export const DELETE = adminRoute(async () => {
  await requireUser('website', 'update');
  await deleteConnection();
  return json({ status: await connectionStatus() });
});
