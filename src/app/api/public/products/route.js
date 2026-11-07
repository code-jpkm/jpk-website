import { connectDB } from '@/lib/db';
import { json, paged } from '@/lib/http';
import { preflight } from '@/lib/cors';
import { listParams, searchFilter, bool } from '@/lib/validate';
import { publicRoute } from '@/lib/publicApi';
import { publicProduct, publicOrigin } from '@/lib/present';
import { loadCategories, descendantIds } from '@/lib/categories';
import { Product } from '@/models/Product';

export const dynamic = 'force-dynamic';

// GET /api/public/products?category=<slug>&featured=1&q=&limit=&page=
// Published products in display order; a category includes the categories below it.
export const GET = publicRoute(async req => {
  const { page, limit, skip, q, sp } = listParams(req, { maxLimit: 200, defaultLimit: 50 });
  await connectDB();
  const filters = [{ status: 'published' }];
  const catSlug = sp.get('category');
  if (catSlug) {
    const cats = await loadCategories();
    // "sanitary-components": the category's web address name from 4 to 6 Nov 2026 (now "sanitary-castings"),
    // so a website section saved with the old name keeps showing its products
    const cat = cats.find(c => c.slug === catSlug) || (catSlug === 'sanitary-components' ? cats.find(c => c.slug === 'sanitary-castings') : null);
    if (!cat) return json(paged([], 0, page, limit));
    filters.push({ category: { $in: descendantIds(cats, cat._id) } });
  }
  if (bool(sp.get('featured'))) filters.push({ featured: true });
  if (q) filters.push(searchFilter(q, ['name', 'code', 'summary']));
  const filter = filters.length > 1 ? { $and: filters } : filters[0];
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ order: 1, name: 1 }).skip(skip).limit(limit).populate('category', 'name slug websitePath').lean(),
    Product.countDocuments(filter),
  ]);
  const origin = publicOrigin(req);
  return json(paged(items.map(p => publicProduct(p, origin)), total, page, limit));
});

export function OPTIONS(req) {
  return preflight(req, 'GET, OPTIONS');
}
