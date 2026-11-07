import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { isObjectId } from '@/lib/validate';
import { loadCategories, flattenTree, categoryLabel } from '@/lib/categories';
import { NoAccess } from '@/components/ui';
import { Product } from '@/models/Product';
import ProductForm from '../ProductForm';
import { productFormData } from '../formData';

export const metadata = { title: 'Edit product' };

export default async function EditProductPage({ params }) {
  const { user, allowed } = await requirePageUser('products');
  if (!allowed) return <NoAccess what="products" />;
  const { id } = await params;
  if (!isObjectId(id)) notFound();
  await connectDB();
  const [product, cats] = await Promise.all([Product.findById(id).lean(), loadCategories()]);
  if (!product) notFound();
  const { pages, norm, groups, websiteUrl } = await productFormData();
  const categories = flattenTree(cats).map(c => ({ _id: String(c._id), name: c.name, depth: c.depth, label: categoryLabel(cats, c._id), path: norm(c.websitePath), pageName: pages.get(norm(c.websitePath)) || '' }));
  return (
    <ProductForm
      key={String(product._id)}
      initial={plain(product)}
      categories={plain(categories)}
      groups={groups}
      websiteUrl={websiteUrl}
      perms={{ update: can(user, 'products', 'update'), delete: can(user, 'products', 'delete') }}
    />
  );
}
