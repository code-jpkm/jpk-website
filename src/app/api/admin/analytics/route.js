import { json, adminRoute } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { analyticsReport, connectionStatus } from '@/lib/analytics/ga4';
import { getPart } from '@/lib/site/store';

export const dynamic = 'force-dynamic';

// GET /api/admin/analytics?days=7|28|90[&fresh=1] -> { status, measurementId, report }
// report: visitors, sessions, page views…, per day, top pages, sources, devices, countries (Google Analytics 4)
export const GET = adminRoute(async req => {
  await requireUser('website', 'view');
  const sp = new URL(req.url).searchParams;
  const [status, part] = await Promise.all([connectionStatus(), getPart('seo')]);
  const measurementId = (part && part.data && part.data.analytics && part.data.analytics.ga4) || '';
  if (!status.connected) return json({ status, measurementId, report: null });
  const report = await analyticsReport(Number(sp.get('days')) || 28, { fresh: sp.get('fresh') === '1' });
  return json({ status, measurementId, report });
});
