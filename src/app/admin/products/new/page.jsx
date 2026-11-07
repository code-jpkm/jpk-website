import { requirePageUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { plain } from '@/lib/http';
import { loadCategories, flattenTree, categoryLabel } from '@/lib/categories';
import { NoAccess } from '@/components/ui';
import ProductForm from '../ProductForm';
import { productFormData } from '../formData';

export const metadata = { title: 'New product' };

export default async function NewProductPage({ searchParams }) {
  const { allowed } = await requirePageUser('products', 'create');
  if (!allowed) return <NoAccess what="new products" />;
  await connectDB();
  const cats = await loadCategories();
  const { pages, norm, groups, websiteUrl } = await productFormData();
  const categories = flattenTree(cats).map(c => ({ _id: String(c._id), name: c.name, depth: c.depth, label: categoryLabel(cats, c._id), path: norm(c.websitePath), pageName: pages.get(norm(c.websitePath)) || '' }));
  const sp = (await searchParams) || {};
  return <ProductForm categories={plain(categories)} groups={groups} websiteUrl={websiteUrl} defaultCategory={typeof sp.category === 'string' ? sp.category : ''} perms={{ update: true, delete: false }} />;
}
