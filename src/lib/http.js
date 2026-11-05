import { NextResponse } from 'next/server';
import { HttpError, isDbDown } from './errors.js';

export function json(data, init) {
  return NextResponse.json(data, init);
}

// Turn any error into a JSON reply with a clear message (details go to the server log only).
export function errorResponse(err, headers) {
  let status = 500;
  let body;
  if (err instanceof HttpError) {
    status = err.status;
    body = { error: err.message };
  } else if (err && err.code === 'CONFIG') {
    status = 503;
    body = { error: err.message };
  } else if (err && err.name === 'ValidationError') {
    status = 400;
    body = { error: validationMessage(err) };
  } else if (err && err.name === 'CastError') {
    status = 400;
    body = { error: 'Some information is not in the right format.' };
  } else if (err && err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    body = {
      error: field === 'email' ? 'A user with this email address already exists.'
        : field === 'slug' ? 'This web address (slug) is already used by another item. Please choose another.'
          : 'This item already exists.',
    };
  } else if (isDbDown(err)) {
    status = 503;
    body = { error: 'The database cannot be reached right now. Please try again in a minute.' };
  } else {
    console.error('[jpk-admin] unexpected error:', err);
    body = { error: 'Something went wrong on the server. Please try again.' };
  }
  const res = NextResponse.json(body, { status, headers });
  if (status === 429 && err.details && err.details.retryAfter) res.headers.set('Retry-After', String(err.details.retryAfter));
  return res;
}

function validationMessage(err) {
  const first = Object.values(err.errors || {})[0];
  if (!first) return 'Please check the form and try again.';
  const field = String(first.path || 'This field').replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  if (first.kind === 'required') return first.message && !first.message.startsWith('Path') ? first.message : `${field} is required.`;
  if (first.kind === 'maxlength') return `${field} is too long.`;
  if (first.kind === 'enum') return `${field} has an unknown value.`;
  return first.message && !first.message.startsWith('Path') ? first.message : `${field} is not valid.`;
}

// Requests that change data must come from this admin site (blocks cross-site form posts).
function assertSameOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin || origin === 'null') {
    if (origin === 'null') throw new HttpError(403, 'This request was blocked.');
    return;
  }
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'This request was blocked.');
  }
  const hosts = [req.headers.get('x-forwarded-host'), req.headers.get('host')]
    .filter(Boolean)
    .map(h => h.split(',')[0].trim());
  if (!hosts.includes(host)) throw new HttpError(403, 'This request came from another website and was blocked.');
}

// Wraps an admin API route: same-site check for changes, and friendly errors.
export function adminRoute(fn) {
  return async (req, ctx) => {
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) assertSameOrigin(req);
      const res = await fn(req, ctx);
      res.headers.set('Cache-Control', 'no-store');
      return res;
    } catch (err) {
      const res = errorResponse(err);
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }
  };
}

export async function readJson(req, { maxBytes = 3_000_000 } = {}) {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'The information sent is too large.');
  let raw;
  try {
    raw = await req.text();
  } catch {
    throw new HttpError(400, 'The request could not be read.');
  }
  if (raw.length > maxBytes) throw new HttpError(413, 'The information sent is too large.');
  if (!raw.trim()) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    throw new HttpError(400, 'The information sent is not valid.');
  }
}

export function paged(items, total, page, limit) {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

// Mongo documents to plain JSON (ids and dates become strings) for client components.
export function plain(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}
