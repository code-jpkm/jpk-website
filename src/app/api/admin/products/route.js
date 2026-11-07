import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute, paged, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { listParams, searchFilter, uniqueSlug, isObjectId } from '@/lib/validate';
import { parseProduct } from '@/lib/inputs';
import { loadCategories, descendantIds } from '@/lib/categories';
import { scheduleSiteRebuild } from '@/lib/siteHook';
import { Product } from '@/models/Product';
import { ProductCategory } from '@/models/ProductCategory';

export const dynamic = 'force-dynamic';

// GET /api/admin/products?q=&status=&category=<id>&page=
export const GET = adminRoute(async req => {
  await requireUser('products', 'view');
  const { page, limit, skip, q, sp } = listParams(req);
  await connectDB();
  const filter = { ...searchFilter(q, ['name', 'code', 'slug', 'summary']) };
  const status = sp.get('status');
  if (status === 'draft' || status === 'published') filter.status = status;
  const category = sp.get('category');
  if (category === 'none') filter.category = null;
  else if (isObjectId(category)) filter.category = { $in: descendantIds(await loadCategories(), category) };
  const [items, total] = await Promise.all([
    Product.find(filter).select('-description -specs -specTable').sort({ order: 1, name: 1 }).skip(skip).limit(limit).populate('category', 'name slug').lean(),
    Product.countDocuments(filter),
  ]);
  return json(paged(plain(items), total, page, limit));
});

// POST /api/admin/products
export const POST = adminRoute(async req => {
  const user = await requireUser('products', 'create');
  const body = await readJson(req);
  const data = parseProduct(body);
  await connectDB();
  if (data.category && !(await ProductCategory.exists({ _id: data.category }))) throw new HttpError(400, 'The chosen category no longer exists.');
  // no display order given: after the last product of its category (so it is added at the end of its website page)
  if (body.order === '' || body.order == null) {
    const last = await Product.findOne(data.category ? { category: data.category } : {}).sort({ order: -1 }).select('order').lean();
    data.order = last ? Math.min(100000, (last.order || 0) + 10) : 0;
  }
  data.slug = await uniqueSlug(Product, data.slug || data.name);
  const doc = await Product.create({ ...data, createdBy: user.id, updatedBy: user.id });
  if (doc.status === 'published') scheduleSiteRebuild('product published');
  return json({ item: plain(doc) }, { status: 201 });
});
