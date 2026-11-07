import { getSchema } from '@/lib/site/schema';
import { websiteUrl } from '@/lib/present';

// for the product form and list: the website page each category has (if any) and the website's groups of cards
export async function productFormData() {
  const { schema } = await getSchema({ quick: true });
  const pages = new Map((schema.pages || []).map(p => [p.path, p.name]));
  const norm = p => (p ? `/${String(p).replace(/^\/+|\/+$/g, '')}/` : '');
  const groups = (schema.productGroups || []).map(g => ({ id: g.id, path: g.path, label: g.label, page: g.page }));
  return { pages, norm, groups, websiteUrl: websiteUrl() };
}
