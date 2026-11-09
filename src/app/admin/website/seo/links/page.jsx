import { requirePageUser } from '@/lib/auth';
import { NoAccess } from '@/components/ui';
import LinksOverview from '@/components/seo/LinksOverview';
import '../seo.css';

export const metadata = { title: 'Links' };
export const dynamic = 'force-dynamic';

export default async function LinksScreen() {
  const { allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="the SEO settings" />;
  return <LinksOverview />;
}
