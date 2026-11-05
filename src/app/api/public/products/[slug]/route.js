import { connectDB } from '@/lib/db';
import { json } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { preflight } from '@/lib/cors';
import { slugify } from '@/lib/validate';
import { publicRoute } from '@/lib/publicApi';
import { publicProduct, publicOrigin } from '@/lib/present';
import { Product } from '@/models/Product';

export const dynamic = 'force-dynamic';

// GET /api/public/products/<slug>: one published product with photos and specifications.
export const GET = publicRoute(async (req, { params }) => {
  const { slug } = await params;
  const clean = slugify(decodeURIComponent(slug || ''), 120);
  if (!clean) throw new HttpError(404, 'Product not found.');
  await connectDB();
  const product = await Product.findOne({ status: 'published', slug: clean }).populate('category', 'name slug websitePath').lean();
  if (!product) throw new HttpError(404, 'Product not found.');
  return json({ item: publicProduct(product, publicOrigin(req)) });
});

export function OPTIONS(req) {
  return preflight(req, 'GET, OPTIONS');
}
