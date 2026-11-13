import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { websiteUrl } from '@/lib/present';
import { NoAccess } from '@/components/ui';
import CategoryManager from './CategoryManager';

export const metadata = { title: 'Product categories' };

export default async function CategoriesPage() {
  const { user, allowed } = await requirePageUser('products');
  if (!allowed) return <NoAccess what="product categories" />;
  const perms = { create: can(user, 'products', 'create'), update: can(user, 'products', 'update'), delete: can(user, 'products', 'delete') };
  return <CategoryManager perms={perms} siteUrl={await websiteUrl()} />;
}
