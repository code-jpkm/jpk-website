import { json } from '@/lib/http';
import { preflight } from '@/lib/cors';
import { publicRoute } from '@/lib/publicApi';
import { publicOrigin } from '@/lib/present';
import { downloadsForWebsite } from '@/lib/downloads';

export const dynamic = 'force-dynamic';

// GET /api/public/downloads -> { items: [{ id, title, category, categoryLabel, description, url, fileName, size }] }
export const GET = publicRoute(async req => json({ items: await downloadsForWebsite(publicOrigin(req)) }));

export function OPTIONS(req) {
  return preflight(req, 'GET, OPTIONS');
}
