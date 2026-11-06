import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { websiteUrl } from '@/lib/present';
import { getSchema } from '@/lib/site/schema';
import { getPart, customPages } from '@/lib/site/store';
import { NoAccess } from '@/components/ui';
import MenuEditor from '@/components/website/MenuEditor';
import { pageOptions } from '@/components/website/util';
import '../website.css';

export const metadata = { title: 'Menu' };
export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const { user, allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="the website editor" />;
  const { schema } = await getSchema();
  const part = await getPart('menus');
  const custom = await customPages();
  return (
    <MenuEditor
      initial={{ data: plain(part ? part.data : null), updatedAt: part && part.updatedAt ? new Date(part.updatedAt).toISOString() : null }}
      builtIn={plain((schema.menus && schema.menus.main) || [])}
      pages={pageOptions(schema, custom)}
      websiteUrl={websiteUrl()}
      canEdit={can(user, 'website', 'update')}
    />
  );
}
