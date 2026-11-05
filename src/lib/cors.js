// Cross-origin rules for the public API used by the website (jpkm.in).
// ALLOWED_ORIGINS: comma-separated website addresses; "*" (the default) allows any site.

function allowedOrigins() {
  return String(process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function originAllowed(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // not sent by a browser on another site
  const list = allowedOrigins();
  return list.includes('*') || list.includes(origin.replace(/\/+$/, ''));
}

export function corsHeaders(req, methods = 'GET, OPTIONS') {
  const headers = {
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  const list = allowedOrigins();
  const origin = req.headers.get('origin');
  if (list.includes('*')) headers['Access-Control-Allow-Origin'] = '*';
  else if (origin && list.includes(origin.replace(/\/+$/, ''))) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function preflight(req, methods) {
  return new Response(null, { status: 204, headers: corsHeaders(req, methods) });
}
