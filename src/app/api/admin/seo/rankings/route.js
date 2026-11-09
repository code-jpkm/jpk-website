import { json, adminRoute } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { gscStatus, rankingsReport, pageRankings } from '@/lib/analytics/gsc';

export const dynamic = 'force-dynamic';

// GET /api/admin/seo/rankings?days=28[&fresh=1]       -> { status, report }: searches, positions, clicks (Search Console)
// GET /api/admin/seo/rankings?path=/about-us/&days=28 -> { status, page }: the searches one page was shown for
export const GET = adminRoute(async req => {
  await requireUser('website', 'view');
  const sp = new URL(req.url).searchParams;
  const status = await gscStatus();
  if (!status.connected) return json({ status, report: null, page: null });
  const days = Number(sp.get('days')) || 28;
  const fresh = sp.get('fresh') === '1';
  if (sp.has('path')) {
    const path = String(sp.get('path') || '/');
    if (!/^\/[\w\-/.%]*$/.test(path)) return json({ status, page: null });
    return json({ status, page: await pageRankings(path, days, { fresh }) });
  }
  return json({ status, report: await rankingsReport(days, { fresh }) });
});
