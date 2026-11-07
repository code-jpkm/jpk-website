import { connectDB } from '@/lib/db';
import { json, adminRoute, plain } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { getSchema } from '@/lib/site/schema';
import { productsInGroups } from '@/lib/products/website';

export const dynamic = 'force-dynamic';

// GET /api/admin/products/on-page?groups=<id>,<id> -> { groups: { <id>: { label, items: [{ _id, name, image }] } } }
// The products the website shows in these groups of a product page (published, in page order), for the website
// editor's note on product sections.
export const GET = adminRoute(async req => {
  await requireUser('products', 'view');
  const ids = String(new URL(req.url).searchParams.get('groups') || '').split(',').filter(g => /^[0-9a-f]{7}$/.test(g)).slice(0, 30);
  const { schema } = await getSchema({ quick: true });
  const groups = (schema.productGroups || []).filter(g => ids.includes(g.id));
  await connectDB();
  const lists = await productsInGroups(schema.productGroups || [], { select: 'name group images builtIn order category' });
  const out = {};
  for (const g of groups) {
    out[g.id] = { label: g.label, items: (lists.get(g.id) || []).map(p => ({ _id: String(p._id), name: p.name, image: (p.images && p.images[0] && p.images[0].url) || '' })) };
  }
  return json({ groups: plain(out) });
});
