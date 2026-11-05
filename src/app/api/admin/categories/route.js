import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { uniqueSlug } from '@/lib/validate';
import { parseCategory } from '@/lib/inputs';
import { loadCategories, flattenTree, categoryLabel } from '@/lib/categories';
import { Product } from '@/models/Product';
import { ProductCategory } from '@/models/ProductCategory';

export const dynamic = 'force-dynamic';

// GET /api/admin/categories: every category in menu order, with depth, full label and product count.
export const GET = adminRoute(async () => {
  await requireUser('products', 'view');
  await connectDB();
  const [cats, counts] = await Promise.all([
    loadCategories(),
    Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map(c => [String(c._id), c.count]));
  const items = flattenTree(cats).map(c => ({ ...c, label: categoryLabel(cats, c._id), productCount: countMap.get(String(c._id)) || 0 }));
  return json({ items: plain(items) });
});

// POST /api/admin/categories
export const POST = adminRoute(async req => {
  await requireUser('products', 'create');
  const data = parseCategory(await readJson(req));
  await connectDB();
  if (data.parent && !(await ProductCategory.exists({ _id: data.parent }))) throw new HttpError(400, 'The chosen parent category no longer exists.');
  data.slug = await uniqueSlug(ProductCategory, data.slug || data.name);
  const doc = await ProductCategory.create(data);
  return json({ item: plain(doc) }, { status: 201 });
});
