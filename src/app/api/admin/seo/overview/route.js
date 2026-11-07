import { json, adminRoute } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { seoOverview } from '@/lib/seo/content';

export const dynamic = 'force-dynamic';

// GET /api/admin/seo/overview -> { rows: [{ key, kind, name, path, title, description, focus, noindex, score, … }] }
export const GET = adminRoute(async () => {
  await requireUser('website', 'view');
  return json({ rows: await seoOverview() });
});
