import { connectDB } from '@/lib/db';
import { json } from '@/lib/http';
import { preflight } from '@/lib/cors';
import { publicRoute } from '@/lib/publicApi';
import { publicCategory, publicOrigin } from '@/lib/present';
import { loadCategories, flattenTree } from '@/lib/categories';
import { Product } from '@/models/Product';

export const dynamic = 'force-dynamic';

// GET /api/public/categories: all product categories in menu order, with the number of published products.
export const GET = publicRoute(async req => {
  await connectDB();
  const [cats, counts] = await Promise.all([
    loadCategories(),
    Product.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map(c => [String(c._id), c.count]));
  const origin = publicOrigin(req);
  const items = flattenTree(cats).map(c => publicCategory(c, origin, { depth: c.depth, productCount: countMap.get(String(c._id)) || 0 }));
  return json({ items, total: items.length });
});

export function OPTIONS(req) {
  return preflight(req, 'GET, OPTIONS');
}
