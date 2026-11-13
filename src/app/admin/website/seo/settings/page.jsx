import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { websiteUrl } from '@/lib/present';
import { getSchema } from '@/lib/site/schema';
import { getPart } from '@/lib/site/store';
import { NoAccess } from '@/components/ui';
import SeoSettings from '@/components/seo/SeoSettings';
import '../seo.css';
import '../../website.css';

export const metadata = { title: 'SEO settings' };
export const dynamic = 'force-dynamic';

export default async function SeoSettingsPage() {
  const { user, allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="the SEO settings" />;
  const [{ schema }, part] = await Promise.all([getSchema(), getPart('seo')]);
  return (
    <SeoSettings
      initial={{ data: plain(part ? part.data : null), updatedAt: part && part.updatedAt ? new Date(part.updatedAt).toISOString() : null }}
      company={plain(schema.company || {})}
      websiteUrl={await websiteUrl()}
      canEdit={can(user, 'website', 'update')}
    />
  );
}
