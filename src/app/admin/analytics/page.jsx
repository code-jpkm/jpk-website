import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { websiteUrl } from '@/lib/present';
import { getPart } from '@/lib/site/store';
import { connectionStatus } from '@/lib/analytics/ga4';
import { NoAccess } from '@/components/ui';
import AnalyticsView from '@/components/analytics/AnalyticsView';
import '../website/seo/seo.css';

export const metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const { user, allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="Analytics" />;
  const [status, part] = await Promise.all([connectionStatus(), getPart('seo')]);
  const measurementId = (part && part.data && part.data.analytics && part.data.analytics.ga4) || '';
  return <AnalyticsView initial={{ status, measurementId }} websiteUrl={websiteUrl()} canEdit={can(user, 'website', 'update')} />;
}
