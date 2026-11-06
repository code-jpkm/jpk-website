import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { websiteUrl } from '@/lib/present';
import { getSchema } from '@/lib/site/schema';
import { getPart } from '@/lib/site/store';
import { NoAccess } from '@/components/ui';
import DesignEditor from '@/components/website/DesignEditor';
import { pageOptions } from '@/components/website/util';
import '../website.css';

export const metadata = { title: 'Design' };
export const dynamic = 'force-dynamic';

export default async function DesignPage() {
  const { user, allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="the website editor" />;
  const { schema } = await getSchema();
  const part = await getPart('settings');
  return (
    <DesignEditor
      initial={{ data: plain(part ? part.data : null), updatedAt: part && part.updatedAt ? new Date(part.updatedAt).toISOString() : null }}
      theme={schema.theme}
      pages={pageOptions(schema)}
      websiteUrl={websiteUrl()}
      canEdit={can(user, 'website', 'update')}
    />
  );
}
