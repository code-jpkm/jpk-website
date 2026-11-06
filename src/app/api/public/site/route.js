import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { publicRoute } from '@/lib/publicApi';
import { preflight } from '@/lib/cors';
import { publicOrigin } from '@/lib/present';
import { siteForWebsite } from '@/lib/site/store';

export const dynamic = 'force-dynamic';

// GET /api/public/site -> the website editor's changes (texts, pictures, sections, new pages, menu, design).
// The website builds with it and its visitors' browsers load it, so saved changes show on the next page load.
// Browsers must check with the server every time (no-cache); unchanged content answers "304 Not Modified".
export const GET = publicRoute(async req => {
  const site = await siteForWebsite(publicOrigin(req));
  const body = JSON.stringify(site);
  const etag = `W/"${createHash('sha1').update(body).digest('base64url').slice(0, 27)}"`;
  const headers = { ETag: etag, 'Cache-Control': 'no-cache', 'Content-Type': 'application/json' };
  const match = String(req.headers.get('if-none-match') || '').split(',').map(s => s.trim());
  if (match.includes(etag)) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(body, { status: 200, headers });
});

export function OPTIONS(req) {
  return preflight(req, 'GET, OPTIONS');
}
