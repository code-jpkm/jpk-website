import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { websiteUrl } from '@/lib/present';
import { getSchema, schemaPage, sectionTypes } from '@/lib/site/schema';
import { getPart, customPages } from '@/lib/site/store';
import { NoAccess } from '@/components/ui';
import PageEditor from '@/components/website/PageEditor';
import { pageOptions } from '@/components/website/util';
import '../website.css';

export const metadata = { title: 'Website editor' };
export const dynamic = 'force-dynamic';

// /admin/website/<Page> (a page of the website), /admin/website/header-footer, /admin/website/custom-<id>
export default async function WebsiteEditPage({ params }) {
  const { user, allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="the website editor" />;
  const { key } = await params;
  const { schema } = await getSchema();
  let mode = 'page';
  let partKey;
  let page = null;
  let customId = null;
  if (key === 'header-footer') { mode = 'global'; partKey = 'global'; }
  else if (key.startsWith('custom-')) {
    customId = key.slice(7);
    if (!/^[a-z0-9]{6,30}$/.test(customId)) notFound();
    mode = 'custom';
    partKey = `custom:${customId}`;
  } else {
    page = schemaPage(schema, key);
    if (!page) notFound();
    partKey = `page:${key}`;
  }
  const part = await getPart(partKey);
  if (mode === 'custom' && !part) notFound();
  const custom = await customPages();
  return (
    <PageEditor
      key={partKey}
      mode={mode}
      partKey={partKey}
      customId={customId}
      schemaPage={page}
      schemaGlobal={schema.global}
      types={sectionTypes(schema)}
      websiteUrl={await websiteUrl()}
      pages={pageOptions(schema, custom)}
      initial={{ data: plain(part ? part.data : {}), updatedAt: part && part.updatedAt ? new Date(part.updatedAt).toISOString() : null }}
      perms={{ update: can(user, 'website', 'update'), delete: can(user, 'website', 'delete'), create: can(user, 'website', 'create'), products: can(user, 'products', 'view') }}
    />
  );
}
