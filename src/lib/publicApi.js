import { corsHeaders } from './cors.js';
import { errorResponse } from './http.js';

// Wraps a route of the public API used by jpkm.in: CORS headers on every reply (errors included),
// short browser caching for successful reads.
export function publicRoute(fn, { methods = 'GET, OPTIONS', cache = 'public, max-age=30, stale-while-revalidate=120' } = {}) {
  return async (req, ctx) => {
    const cors = corsHeaders(req, methods);
    try {
      const res = await fn(req, ctx);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      if (!res.headers.has('Cache-Control')) res.headers.set('Cache-Control', req.method === 'GET' && res.ok ? cache : 'no-store');
      return res;
    } catch (err) {
      const res = errorResponse(err, cors);
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }
  };
}

// The day (India time) as a UTC-midnight date, for comparing with job closing dates (stored as dates).
export function startOfTodayIndia() {
  const now = new Date(Date.now() + 330 * 60 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function openJobsFilter() {
  return { status: 'published', $or: [{ closingDate: null }, { closingDate: { $gte: startOfTodayIndia() } }] };
}

export function publishedPostsFilter() {
  return { status: 'published', publishedAt: { $lte: new Date() } };
}
