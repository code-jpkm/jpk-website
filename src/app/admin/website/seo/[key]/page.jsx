import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { websiteUrl } from '@/lib/present';
import { seoPage } from '@/lib/seo/content';
import { gscStatus } from '@/lib/analytics/gsc';
import { NoAccess } from '@/components/ui';
import SeoPageEditor from '@/components/seo/SeoPageEditor';
import '../seo.css';
import '../../website.css';

export const metadata = { title: 'SEO of a page' };
export const dynamic = 'force-dynamic';

// /admin/website/seo/<Page> or /admin/website/seo/custom-<id>
export default async function SeoPageScreen({ params }) {
  const { user, allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="the SEO settings" />;
  const { key } = await params;
  const partKey = /^custom-[a-z0-9]{6,30}$/.test(key) ? `custom:${key.slice(7)}` : /^[A-Za-z0-9]{1,60}$/.test(key) ? `page:${key}` : null;
  if (!partKey) notFound();
  const [page, gsc] = await Promise.all([seoPage(partKey), gscStatus().catch(() => ({ connected: false }))]);
  if (!page) notFound();
  return <SeoPageEditor key={partKey} page={plain(page)} websiteUrl={await websiteUrl()} canEdit={can(user, 'website', 'update')} gscConnected={Boolean(gsc.connected)} />;
}
