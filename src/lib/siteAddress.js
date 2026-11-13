import { connectDB } from './db.js';
import { getSetting, setSetting } from '../models/Setting.js';

// The public website's address (e.g. https://jpkm.in, or http://localhost:5173 while testing).
// Set in the admin (Website › Website address); WEBSITE_URL (Render › Environment) is the fallback, then
// https://jpkm.in. The website has the same address in its config.js (siteUrl).
// Used by the editor's preview, the links and SEO tools, Google Search Console, exports and the allowed origins
// of the public API.

const KEY = 'website.url';
export const DEFAULT_WEBSITE_URL = 'https://jpkm.in';
const TTL = 30 * 1000;
// one copy for the whole server (route handlers and pages are separate bundles)
const cache = globalThis.__jpkWebsiteUrl || (globalThis.__jpkWebsiteUrl = { value: null, saved: null, at: 0 });

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|[a-z0-9-]+\.local|[a-z0-9-]+\.localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;

// "jpkm.in", "https://jpkm.in/", "localhost:5173" → "https://jpkm.in", "http://localhost:5173"; '' if not an address
export function cleanWebsiteAddress(v) {
  let s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (s.length > 200 || /[\s"'<>\\]/.test(s)) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    const host = s.split(/[/:?#]/)[0];
    s = `${LOCAL.test(host) ? 'http' : 'https'}://${s}`;
  }
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol) || !u.hostname || u.username || u.password) return '';
    if (!/\./.test(u.hostname) && !LOCAL.test(u.hostname)) return '';
    return u.origin;
  } catch {
    return '';
  }
}

export function isLocalAddress(url) {
  try { return LOCAL.test(new URL(url).hostname); } catch { return false; }
}

export function envWebsiteUrl() {
  return cleanWebsiteAddress(process.env.WEBSITE_URL) || DEFAULT_WEBSITE_URL;
}

async function load() {
  let saved = '';
  try {
    await connectDB();
    saved = cleanWebsiteAddress(await getSetting(KEY));
  } catch {
    /* database not reachable: keep the last known address */
    if (cache.value) return cache.value;
  }
  cache.saved = saved;
  cache.value = saved || envWebsiteUrl();
  cache.at = Date.now();
  return cache.value;
}

// the address to use now
export async function websiteUrl() {
  if (cache.value && Date.now() - cache.at < TTL) return cache.value;
  return load();
}

// without waiting (CORS checks, link sorting): the last address read, else the fallback
export function knownWebsiteUrl() {
  return cache.value || envWebsiteUrl();
}

// for the settings card: what is used and where it comes from
export async function websiteAddress() {
  const url = await load();
  return { url, saved: cache.saved || '', fallback: envWebsiteUrl(), fromEnv: Boolean(cleanWebsiteAddress(process.env.WEBSITE_URL)), local: isLocalAddress(url) };
}

// '' or null: back to WEBSITE_URL / https://jpkm.in
export async function saveWebsiteAddress(v) {
  const clean = cleanWebsiteAddress(v);
  await connectDB();
  await setSetting(KEY, clean || null);
  cache.saved = clean;
  cache.value = clean || envWebsiteUrl();
  cache.at = Date.now();
  return cache.value;
}
