import { requirePageUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { loadCategories, flattenTree, categoryLabel } from '@/lib/categories';
import { NoAccess } from '@/components/ui';
import ProductList from './ProductList';

export const metadata = { title: 'Products' };

export default async function ProductsPage({ searchParams }) {
  const { user, allowed } = await requirePageUser('products');
  if (!allowed) return <NoAccess what="products" />;
  await connectDB();
  const cats = await loadCategories();
  const categories = flattenTree(cats).map(c => ({ _id: String(c._id), name: c.name, depth: c.depth, label: categoryLabel(cats, c._id) }));
  const perms = { create: can(user, 'products', 'create'), update: can(user, 'products', 'update'), delete: can(user, 'products', 'delete') };
  const sp = (await searchParams) || {};
  const initialCategory = typeof sp.category === 'string' && (sp.category === 'none' || categories.some(c => c._id === sp.category)) ? sp.category : '';
  return <ProductList key={initialCategory || "all"} perms={perms} categories={plain(categories)} initialCategory={initialCategory} />;
}
