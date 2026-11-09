import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';
import { connectDB } from '../db.js';
import { HttpError } from '../errors.js';
import { getSetting, setSetting } from '../../models/Setting.js';

// Google Analytics 4 reports in the admin (Analytics page), read with the Google Analytics Data API.
//
// Connection: a Google Cloud "service account" key (JSON) that has Viewer access to the GA4 property, plus the
// property's number. Kept in the database (Setting "ga.connection"), the private key encrypted with JWT_SECRET;
// or given as environment variables GA_PROPERTY_ID + GA_SERVICE_ACCOUNT_JSON. The browser never sees the key.
// GA_TOKEN_URL / GA_DATA_API point elsewhere for tests.

const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const tokenUrl = () => process.env.GA_TOKEN_URL || GOOGLE_TOKEN;
const apiBase = () => String(process.env.GA_DATA_API || 'https://analyticsdata.googleapis.com').replace(/\/+$/, '');
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

const secretKey = () => createHash('sha256').update(`jpk-ga4:${process.env.JWT_SECRET || process.env.AUTH_SECRET || 'jpk-admin'}`).digest();
export function seal(text) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', secretKey(), iv);
  const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}
export function unseal(s) {
  const [iv, tag, enc] = String(s || '').split('.').map(x => Buffer.from(x, 'base64'));
  const d = createDecipheriv('aes-256-gcm', secretKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

export function parseServiceAccount(text) {
  let j;
  try { j = typeof text === 'string' ? JSON.parse(text) : text; } catch { j = null; }
  if (!j || typeof j !== 'object') throw new HttpError(400, 'The key file could not be read. Choose the .json file Google downloaded when you created the key.');
  if (j.type !== 'service_account' || !j.client_email || !j.private_key) throw new HttpError(400, 'This is not a service account key: it must contain "type": "service_account", a client_email and a private_key.');
  if (!/BEGIN PRIVATE KEY/.test(j.private_key)) throw new HttpError(400, 'The key file has no usable private key.');
  return { clientEmail: String(j.client_email).trim(), privateKey: String(j.private_key), keyId: j.private_key_id ? String(j.private_key_id) : undefined };
}

export function parsePropertyId(v) {
  const s = String(v || '').trim().replace(/^properties\//, '');
  if (!/^\d{5,15}$/.test(s)) throw new HttpError(400, 'The property ID is a number such as 412345678 (Google Analytics › Admin › Property details).');
  return s;
}

// { propertyId, clientEmail, privateKey, keyId, at, source } or null
export async function getConnection() {
  if (process.env.GA_PROPERTY_ID && process.env.GA_SERVICE_ACCOUNT_JSON) {
    const sa = parseServiceAccount(process.env.GA_SERVICE_ACCOUNT_JSON);
    return { ...sa, propertyId: parsePropertyId(process.env.GA_PROPERTY_ID), source: 'environment' };
  }
  await connectDB();
  const s = await getSetting('ga.connection');
  if (!s || !s.key) return null;
  try {
    return { propertyId: s.propertyId, clientEmail: s.clientEmail, keyId: s.keyId, privateKey: unseal(s.key), at: s.at, source: 'admin' };
  } catch {
    return { propertyId: s.propertyId, clientEmail: s.clientEmail, broken: true, at: s.at, source: 'admin' };
  }
}

// what the screens may show about the connection
export async function connectionStatus() {
  const c = await getConnection();
  if (!c) return { connected: false };
  return { connected: !c.broken, broken: Boolean(c.broken), propertyId: c.propertyId, clientEmail: c.clientEmail, source: c.source, at: c.at || null };
}

const tokens = new Map();
const accessToken = conn => googleAccessToken(conn, SCOPE);
// an access token for a Google API (scope) from a service account key (also used for Search Console)
export async function googleAccessToken(conn, scope) {
  // per key (a replaced or wrong key never reuses the token of another one) and per API
  const ck = `${conn.clientEmail}|${scope}|${createHash('sha256').update(String(conn.privateKey)).digest('hex').slice(0, 16)}`;
  const cached = tokens.get(ck);
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  let key;
  try { key = await importPKCS8(conn.privateKey, 'RS256'); } catch { throw new HttpError(400, 'The private key in the key file could not be used.'); }
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', ...(conn.keyId ? { kid: conn.keyId } : {}) })
    .setIssuer(conn.clientEmail).setSubject(conn.clientEmail).setAudience(GOOGLE_TOKEN)
    .setIssuedAt(now).setExpirationTime(now + 3600)
    .sign(key);
  let res, j;
  try {
    res = await fetch(tokenUrl(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(15_000) });
    j = await res.json().catch(() => ({}));
  } catch {
    throw new HttpError(502, 'Google could not be reached. Try again in a minute.');
  }
  if (!res.ok || !j.access_token) throw new HttpError(400, `Google did not accept the key (${j.error_description || j.error || res.status}). Check that the key is current and the service account exists.`);
  tokens.set(ck, { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 });
  return j.access_token;
}

async function call(conn, method, body) {
  const token = await accessToken(conn);
  let res, j;
  try {
    res = await fetch(`${apiBase()}/v1beta/properties/${conn.propertyId}:${method}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    j = await res.json().catch(() => ({}));
  } catch {
    throw new HttpError(502, 'Google Analytics could not be reached. Try again in a minute.');
  }
  if (!res.ok) {
    const msg = (j.error && j.error.message) || `HTTP ${res.status}`;
    if (res.status === 403) throw new HttpError(403, `Google Analytics refused access. In Google Analytics › Admin › Property access management, add ${conn.clientEmail} as a Viewer. (${msg})`);
    if (res.status === 404 || res.status === 400) throw new HttpError(400, `Google Analytics did not find property ${conn.propertyId}. Check the property ID. (${msg})`);
    throw new HttpError(502, `Google Analytics: ${msg}`);
  }
  return j;
}

export async function saveConnection({ propertyId, key }) {
  const sa = parseServiceAccount(key);
  const conn = { ...sa, propertyId: parsePropertyId(propertyId) };
  // try it first: a small report
  await call(conn, 'runReport', { dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }], metrics: [{ name: 'activeUsers' }], limit: 1 });
  await connectDB();
  await setSetting('ga.connection', { propertyId: conn.propertyId, clientEmail: conn.clientEmail, keyId: conn.keyId, key: seal(conn.privateKey), at: new Date().toISOString() });
  cache.clear();
  return connectionStatus();
}

export async function deleteConnection() {
  await connectDB();
  await setSetting('ga.connection', null);
  cache.clear();
}

// ---- the report ----

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const rowsOf = rep => (rep && Array.isArray(rep.rows) ? rep.rows : []);
const dims = r => (r.dimensionValues || []).map(d => d.value);
const mets = r => (r.metricValues || []).map(m => num(m.value));

const cache = new Map();
const TTL = 10 * 60 * 1000;

const ymd = s => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s);

// { range, totals: { users, newUsers, sessions, views, avgSession, engagement }, previous: {…}, daily: [{ date, users, views }],
//   pages: [{ path, title, views, users }], sources: [{ name, sessions }], devices: [{ name, users }],
//   countries: [{ name, users }], live, at }
export async function analyticsReport(days = 28, { fresh = false } = {}) {
  const conn = await getConnection();
  if (!conn) return null;
  if (conn.broken) throw new HttpError(400, 'The saved Google key can no longer be read (JWT_SECRET changed?). Connect Google Analytics again.');
  const n = [7, 28, 90].includes(Number(days)) ? Number(days) : 28;
  const ck = `${conn.propertyId}:${n}`;
  const hit = cache.get(ck);
  if (!fresh && hit && Date.now() - hit.at < TTL) return hit.value;

  const current = { startDate: `${n - 1}daysAgo`, endDate: 'today' };
  const previous = { startDate: `${2 * n - 1}daysAgo`, endDate: `${n}daysAgo` };
  const TOTALS = ['activeUsers', 'newUsers', 'sessions', 'screenPageViews', 'averageSessionDuration', 'engagementRate'];
  const batch = await call(conn, 'batchRunReports', {
    requests: [
      { dateRanges: [current, previous], metrics: TOTALS.map(name => ({ name })) },
      { dateRanges: [current], dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }], orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 },
      { dateRanges: [current], dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }], metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10 },
      { dateRanges: [current], dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 8 },
      { dateRanges: [current], dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 5 },
    ],
  });
  const [tot, daily, pages, sources, devices] = (batch && batch.reports) || [];
  const countries = await call(conn, 'runReport', { dateRanges: [current], dimensions: [{ name: 'country' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 8 });
  let live = null;
  try {
    const rt = await call(conn, 'runRealtimeReport', { metrics: [{ name: 'activeUsers' }] });
    live = rowsOf(rt).reduce((s, r) => s + mets(r)[0], 0);
  } catch { /* realtime is a bonus */ }

  const pickTotals = label => {
    const rows = rowsOf(tot);
    const r = rows.find(x => dims(x).includes(label)) || (label === 'date_range_0' && rows.length === 1 ? rows[0] : null);
    const m = r ? mets(r) : TOTALS.map(() => 0);
    return { users: m[0], newUsers: m[1], sessions: m[2], views: m[3], avgSession: m[4], engagement: m[5] };
  };
  // every day of the range, also days without visitors
  const byDay = new Map(rowsOf(daily).map(r => [ymd(dims(r)[0]), mets(r)]));
  const days_ = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const m = byDay.get(d) || [0, 0];
    days_.push({ date: d, users: m[0], views: m[1] });
  }
  const value = {
    range: n,
    totals: pickTotals('date_range_0'),
    previous: pickTotals('date_range_1'),
    daily: days_,
    pages: rowsOf(pages).map(r => ({ path: dims(r)[0], title: dims(r)[1], views: mets(r)[0], users: mets(r)[1] })),
    sources: rowsOf(sources).map(r => ({ name: dims(r)[0] || '(not set)', sessions: mets(r)[0] })),
    devices: rowsOf(devices).map(r => ({ name: dims(r)[0] || '(not set)', users: mets(r)[0] })),
    countries: rowsOf(countries).map(r => ({ name: dims(r)[0] || '(not set)', users: mets(r)[0] })),
    live,
    at: new Date().toISOString(),
  };
  cache.set(ck, { at: Date.now(), value });
  return value;
}
