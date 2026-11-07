import { requirePageUser } from '@/lib/auth';
import { getPart } from '@/lib/site/store';
import { NoAccess } from '@/components/ui';
import SeoOverview from '@/components/seo/SeoOverview';
import './seo.css';

export const metadata = { title: 'SEO' };
export const dynamic = 'force-dynamic';

export default async function SeoPage() {
  const { allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="the SEO settings" />;
  const part = await getPart('seo');
  return <SeoOverview gaSet={Boolean(part && part.data && part.data.analytics && part.data.analytics.ga4)} />;
}
