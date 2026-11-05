import { requirePageUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { plain } from '@/lib/http';
import { loadCategories, flattenTree, categoryLabel } from '@/lib/categories';
import { NoAccess } from '@/components/ui';
import ProductForm from '../ProductForm';

export const metadata = { title: 'New product' };

export default async function NewProductPage({ searchParams }) {
  const { allowed } = await requirePageUser('products', 'create');
  if (!allowed) return <NoAccess what="new products" />;
  await connectDB();
  const cats = await loadCategories();
  const categories = flattenTree(cats).map(c => ({ _id: String(c._id), name: c.name, depth: c.depth, label: categoryLabel(cats, c._id) }));
  const sp = (await searchParams) || {};
  return <ProductForm categories={plain(categories)} defaultCategory={typeof sp.category === 'string' ? sp.category : ''} perms={{ update: true, delete: false }} />;
}
