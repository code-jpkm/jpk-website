import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { websiteUrl } from '@/lib/present';
import { pageLinks } from '@/lib/seo/links';
import { NoAccess } from '@/components/ui';
import { keyFromSlug } from '@/lib/seo/keys';
import LinksPage from '@/components/seo/LinksPage';
import '../../seo.css';

export const metadata = { title: 'Links of a page' };
export const dynamic = 'force-dynamic';

// /admin/website/seo/links/<AboutUs | custom-… | post-… | global>
export default async function LinksPageScreen({ params }) {
  const { user, allowed } = await requirePageUser('website');
  if (!allowed) return <NoAccess what="the SEO settings" />;
  const { key: slug } = await params;
  const key = keyFromSlug(slug);
  if (!key) notFound();
  const page = await pageLinks(key);
  if (!page) notFound();
  const canEdit = can(user, key.startsWith('post:') ? 'blogs' : 'website', 'update');
  return <LinksPage key={key} page={plain(page)} canEdit={canEdit} websiteUrl={websiteUrl()} />;
}
