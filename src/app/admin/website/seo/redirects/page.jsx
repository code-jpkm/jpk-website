import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { websiteUrl } from '@/lib/present';
import { getSchema } from '@/lib/site/schema';
import { getPart } from '@/lib/site/store';
import { NoAccess } from '@/components/ui';
import RedirectsEditor from '@/components/seo/RedirectsEditor';
import { pageOptions } from '@/components/website/util';
import '../seo.css';

export const metadata = { title: 'Redirects' };
export const dynamic = 'force-dynamic';

export default async function RedirectsPage() {
  const { user, allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="the SEO settings" />;
  const [{ schema }, part] = await Promise.all([getSchema(), getPart('seo')]);
  return (
    <RedirectsEditor
      initial={{ data: plain(part ? part.data : null), updatedAt: part && part.updatedAt ? new Date(part.updatedAt).toISOString() : null }}
      builtIn={plain(schema.redirects || [])}
      pages={pageOptions(schema)}
      websiteUrl={websiteUrl()}
      canEdit={can(user, 'website', 'update')}
    />
  );
}
