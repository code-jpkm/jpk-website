import { connectDB } from '../db.js';
import { HttpError } from '../errors.js';
import { getSetting, setSetting } from '../../models/Setting.js';
import { websiteUrl } from '../present.js';
import { getConnection as gaConnection, parseServiceAccount, seal, unseal, googleAccessToken } from './ga4.js';

// Google Search Console in the admin (SEO › Rankings, and each page's "In Google"): the searches people made on
// Google, how often the website was shown (impressions), clicked, and its average position — like Rank Math's
// analytics. Read with the Search Console API using a service account key (the Google Analytics one, or its own),
// added in Search Console as a user of the property.
//
// Connection: Setting "gsc.connection" = { siteUrl, useGa } or { siteUrl, clientEmail, keyId, key (encrypted), at };
// or the environment variables GSC_SITE_URL (+ GSC_SERVICE_ACCOUNT_JSON, else the Google Analytics key).
// GSC_API points elsewhere for tests.

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const apiBase = () => String(process.env.GSC_API || 'https://searchconsole.googleapis.com').replace(/\/+$/, '');

// "jpkm.in" / "sc-domain:jpkm.in" (a domain property) or "https://jpkm.in/" (an address-prefix property)
export function parseSiteUrl(v) {
  const s = String(v || '').trim();
  if (/^sc-domain:[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return s.toLowerCase();
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(s)) return `sc-domain:${s.toLowerCase().replace(/^www\./, '')}`;
  if (/^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}(:\d+)?(\/[^\s]*)?$/i.test(s)) return /\/$/.test(s) ? s : `${s}/`;
  throw new HttpError(400, 'Enter the Search Console property: the domain (jpkm.in) or the address prefix (https://jpkm.in/).');
}

// { siteUrl, clientEmail, privateKey, keyId, useGa, source } | { siteUrl, broken: true, … } | null
export async function gscConnection() {
  if (process.env.GSC_SITE_URL) {
    const siteUrl = parseSiteUrl(process.env.GSC_SITE_URL);
    if (process.env.GSC_SERVICE_ACCOUNT_JSON) return { siteUrl, ...parseServiceAccount(process.env.GSC_SERVICE_ACCOUNT_JSON), source: 'environment' };
    const ga = await gaConnection();
    if (ga && !ga.broken) return { siteUrl, clientEmail: ga.clientEmail, privateKey: ga.privateKey, keyId: ga.keyId, useGa: true, source: 'environment' };
    return { siteUrl, broken: true, needsKey: true, source: 'environment' };
  }
  await connectDB();
  const s = await getSetting('gsc.connection');
  if (!s || !s.siteUrl) return null;
  if (s.useGa) {
    const ga = await gaConnection();
    if (!ga || ga.broken) return { siteUrl: s.siteUrl, useGa: true, broken: true, needsKey: true, at: s.at, source: 'admin' };
    return { siteUrl: s.siteUrl, clientEmail: ga.clientEmail, privateKey: ga.privateKey, keyId: ga.keyId, useGa: true, at: s.at, source: 'admin' };
  }
  try {
    return { siteUrl: s.siteUrl, clientEmail: s.clientEmail, keyId: s.keyId, privateKey: unseal(s.key), at: s.at, source: 'admin' };
  } catch {
    return { siteUrl: s.siteUrl, clientEmail: s.clientEmail, broken: true, at: s.at, source: 'admin' };
  }
}

// what the screens may show (no secrets)
export async function gscStatus() {
  const c = await gscConnection();
  const ga = await gaConnection().catch(() => null);
  const gaEmail = ga && !ga.broken ? ga.clientEmail : null;
  if (!c) return { connected: false, gaEmail };
  return { connected: !c.broken, broken: Boolean(c.broken), needsKey: Boolean(c.needsKey), siteUrl: c.siteUrl, clientEmail: c.clientEmail || gaEmail, useGa: Boolean(c.useGa), source: c.source, at: c.at || null, gaEmail };
}

async function query(conn, body) {
  const token = await googleAccessToken(conn, SCOPE);
  let res, j;
  try {
    res = await fetch(`${apiBase()}/webmasters/v3/sites/${encodeURIComponent(conn.siteUrl)}/searchAnalytics/query`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    });
    j = await res.json().catch(() => ({}));
  } catch {
    throw new HttpError(502, 'Google Search Console could not be reached. Try again in a minute.');
  }
  if (!res.ok) {
    const msg = (j.error && j.error.message) || `HTTP ${res.status}`;
    if (res.status === 403) throw new HttpError(403, `Search Console refused access. In Search Console › Settings › Users and permissions, add ${conn.clientEmail} (Restricted is enough), and switch on the “Google Search Console API” in Google Cloud. (${msg})`);
    if (res.status === 404) throw new HttpError(400, `Search Console has no property “${conn.siteUrl}” for this key. Check the property (domain or address prefix). (${msg})`);
    throw new HttpError(502, `Search Console: ${msg}`);
  }
  return j;
}

// Search Console's data are complete about 2 days later
const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const range = days => ({ startDate: day(days + 1), endDate: day(2) });
const prevRange = days => ({ startDate: day(2 * days + 1), endDate: day(days + 2) });

export async function saveGsc({ siteUrl, key, useGa }) {
  const site = parseSiteUrl(siteUrl);
  let conn;
  if (useGa) {
    const ga = await gaConnection();
    if (!ga || ga.broken) throw new HttpError(400, 'Connect Google Analytics first (Analytics page), or choose a key file here.');
    conn = { siteUrl: site, clientEmail: ga.clientEmail, privateKey: ga.privateKey, keyId: ga.keyId };
  } else conn = { siteUrl: site, ...parseServiceAccount(key) };
  await query(conn, { ...range(7), rowLimit: 1 }); // try it first
  await connectDB();
  await setSetting('gsc.connection', useGa ? { siteUrl: site, useGa: true, at: new Date().toISOString() } : { siteUrl: site, clientEmail: conn.clientEmail, keyId: conn.keyId, key: seal(conn.privateKey), at: new Date().toISOString() });
  cache.clear();
  return gscStatus();
}

export async function deleteGsc() {
  await connectDB();
  await setSetting('gsc.connection', null);
  cache.clear();
}

// ---- the reports ----

const cache = new Map();
const TTL = 60 * 60 * 1000;
const n = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const row = r => ({ clicks: n(r.clicks), impressions: n(r.impressions), ctr: Math.round(n(r.ctr) * 1000) / 10, position: Math.round(n(r.position) * 10) / 10 });
const pathOf = url => { try { return new URL(url).pathname || '/'; } catch { return url; } };

async function cached(ck, fresh, make) {
  const hit = cache.get(ck);
  if (!fresh && hit && Date.now() - hit.at < TTL) return hit.value;
  const value = await make();
  cache.set(ck, { at: Date.now(), value });
  return value;
}

// { range, start, end, totals, previous, daily, queries: [{ query, …, prevPosition, change }], pages: [{ path, url, … }], at }
export async function rankingsReport(days = 28, { fresh = false } = {}) {
  const conn = await gscConnection();
  if (!conn) return null;
  if (conn.broken) throw new HttpError(400, conn.needsKey ? 'Search Console uses the Google Analytics key, which is not connected (any more). Connect Google Analytics again, or choose a key file here.' : 'The saved key can no longer be read (JWT_SECRET changed?). Connect Search Console again.');
  const d = [7, 28, 90].includes(Number(days)) ? Number(days) : 28;
  return cached(`${conn.siteUrl}:${d}`, fresh, async () => {
    const cur = range(d), prev = prevRange(d);
    const [tot, totPrev, daily, queries, queriesPrev, pages] = await Promise.all([
      query(conn, { ...cur }),
      query(conn, { ...prev }),
      query(conn, { ...cur, dimensions: ['date'], rowLimit: 500 }),
      query(conn, { ...cur, dimensions: ['query'], rowLimit: 1000 }),
      query(conn, { ...prev, dimensions: ['query'], rowLimit: 1000 }),
      query(conn, { ...cur, dimensions: ['page'], rowLimit: 500 }),
    ]);
    const before = new Map((queriesPrev.rows || []).map(r => [String(r.keys[0]).toLowerCase(), row(r).position]));
    return {
      range: d, start: cur.startDate, end: cur.endDate,
      totals: (tot.rows || [])[0] ? row(tot.rows[0]) : row({}),
      previous: (totPrev.rows || [])[0] ? row(totPrev.rows[0]) : row({}),
      daily: (daily.rows || []).map(r => ({ date: r.keys[0], ...row(r) })).sort((a, b) => a.date.localeCompare(b.date)),
      queries: (queries.rows || []).map(r => {
        const q = String(r.keys[0]);
        const p = before.get(q.toLowerCase());
        const x = row(r);
        return { query: q, ...x, prevPosition: p ?? null, change: p ? Math.round((p - x.position) * 10) / 10 : null };
      }),
      pages: (pages.rows || []).map(r => ({ url: r.keys[0], path: pathOf(r.keys[0]), ...row(r) })),
      at: new Date().toISOString(),
    };
  });
}

// the searches one page of the website was shown for: { queries: [{ query, clicks, impressions, ctr, position }], totals }
export async function pageRankings(path, days = 28, { fresh = false } = {}) {
  const conn = await gscConnection();
  if (!conn || conn.broken) return null;
  const d = [7, 28, 90].includes(Number(days)) ? Number(days) : 28;
  const url = `${await websiteUrl()}${path}`;
  return cached(`${conn.siteUrl}:${d}:${url}`, fresh, async () => {
    const filter = { dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: url }] }] };
    const cur = range(d);
    const [tot, queries] = await Promise.all([
      query(conn, { ...cur, ...filter }),
      query(conn, { ...cur, ...filter, dimensions: ['query'], rowLimit: 100 }),
    ]);
    return {
      range: d, url, totals: (tot.rows || [])[0] ? row(tot.rows[0]) : row({}),
      queries: (queries.rows || []).map(r => ({ query: String(r.keys[0]), ...row(r) })),
      at: new Date().toISOString(),
    };
  });
}
