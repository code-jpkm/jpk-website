import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { websiteUrl } from '@/lib/present';
import { getSchema } from '@/lib/site/schema';
import { customPages } from '@/lib/site/store';
import { gscStatus } from '@/lib/analytics/gsc';
import { keyphraseList } from '@/lib/seo/content';
import { NoAccess } from '@/components/ui';
import RankingsView from '@/components/seo/RankingsView';
import '../seo.css';

export const metadata = { title: 'Rankings' };
export const dynamic = 'force-dynamic';

export default async function RankingsScreen() {
  const { user, allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="the SEO settings" />;
  const [status, keyphrases, { schema }, custom] = await Promise.all([gscStatus(), keyphraseList(), getSchema({ quick: true }), customPages()]);
  const pages = [
    ...schema.pages.map(p => ({ path: p.path, name: p.name, href: `/admin/website/seo/${p.page}` })),
    ...custom.filter(p => p.path).map(p => ({ path: p.path, name: p.title, href: `/admin/website/seo/custom-${p.id}` })),
  ];
  return <RankingsView status={plain(status)} canEdit={can(user, 'website', 'update')} websiteUrl={await websiteUrl()} keyphrases={plain(keyphrases)} pages={pages} />;
}
