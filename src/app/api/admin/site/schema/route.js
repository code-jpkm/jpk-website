import { json, adminRoute } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { websiteUrl } from '@/lib/present';
import { getSchema } from '@/lib/site/schema';

export const dynamic = 'force-dynamic';

// GET /api/admin/site/schema[?fresh=1] -> what the website editor can change, and where it came from
export const GET = adminRoute(async req => {
  await requireUser('website', 'view');
  const fresh = new URL(req.url).searchParams.get('fresh') === '1';
  const { schema, source } = await getSchema({ fresh });
  return json({ schema, source, websiteUrl: await websiteUrl() });
});
