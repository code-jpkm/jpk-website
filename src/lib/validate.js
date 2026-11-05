import mongoose from 'mongoose';
import { HttpError } from './errors.js';

// Small helpers that clean up form input and explain problems in plain words.

export function text(value, { max = 200, required = false, label = 'This field' } = {}) {
  const s = value == null ? '' : String(value).replace(/\r\n/g, '\n').trim();
  if (required && !s) throw new HttpError(400, `${label} is required.`);
  if (s.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer.`);
  return s;
}

// Single-line text: newlines and repeated spaces become one space.
export function line(value, opts = {}) {
  return text(value == null ? '' : String(value).replace(/\s+/g, ' '), opts);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function email(value, { required = true, label = 'Email address' } = {}) {
  const s = line(value, { max: 200, required, label }).toLowerCase();
  if (s && !EMAIL_RE.test(s)) throw new HttpError(400, `${label} does not look right. Please check it.`);
  return s;
}

// A list of short texts: accepts an array or text with one item per line.
export function list(value, { maxItems = 50, max = 500, label = 'List' } = {}) {
  const raw = Array.isArray(value) ? value : String(value || '').split('\n');
  const out = raw.map(v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (out.length > maxItems) throw new HttpError(400, `${label} can have at most ${maxItems} items.`);
  for (const item of out) if (item.length > max) throw new HttpError(400, `Each item in ${label.toLowerCase()} must be ${max} characters or fewer.`);
  return out;
}

export function int(value, { min = 0, max = 1e9, fallback = 0, label = 'Number' } = {}) {
  if (value === '' || value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new HttpError(400, `${label} must be a number.`);
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function bool(value) {
  return value === true || value === 'true' || value === 'on' || value === '1' || value === 1 || value === 'yes';
}

export function oneOf(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

export function dateOrNull(value, label = 'Date') {
  if (value === '' || value == null) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${label} is not a valid date.`);
  return d;
}

export function objectIdOrNull(value, label = 'Item') {
  if (value === '' || value == null) return null;
  if (!mongoose.isValidObjectId(value)) throw new HttpError(400, `${label} is not valid.`);
  return new mongoose.Types.ObjectId(String(value));
}

export function isObjectId(value) {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

// A picture chosen in the admin (uploaded through /api/admin/upload).
export function image(value, { label = 'Picture' } = {}) {
  if (!value || typeof value !== 'object' || !value.url) return null;
  const url = String(value.url).trim();
  if (!/^https?:\/\//i.test(url) && !/^\/api\/files\/[a-f0-9]{24}$/i.test(url)) throw new HttpError(400, `${label} has an invalid address.`);
  if (url.length > 1000) throw new HttpError(400, `${label} address is too long.`);
  const provider = ['cloudinary', 'db', 'external'].includes(value.provider) ? value.provider : 'external';
  const w = Number(value.width);
  const h = Number(value.height);
  return {
    url,
    publicId: value.publicId ? String(value.publicId).slice(0, 300) : undefined,
    provider,
    alt: line(value.alt, { max: 300, label: 'Picture description (alt text)' }),
    width: Number.isFinite(w) && w > 0 ? Math.round(w) : undefined,
    height: Number.isFinite(h) && h > 0 ? Math.round(h) : undefined,
  };
}

export function images(value, { maxItems = 30 } = {}) {
  const arr = Array.isArray(value) ? value : [];
  if (arr.length > maxItems) throw new HttpError(400, `A product can have at most ${maxItems} photos.`);
  return arr.map(v => image(v, { label: 'Photo' })).filter(Boolean);
}

export function slugify(value, max = 80) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

export function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Pick a free URL slug: "title", then "title-2", "title-3", ...
export async function uniqueSlug(Model, wanted, excludeId) {
  const base = slugify(wanted) || 'item';
  const filter = { slug: { $regex: `^${escapeRegex(base)}(-[0-9]+)?$` } };
  if (excludeId) filter._id = { $ne: excludeId };
  const taken = new Set((await Model.find(filter).select('slug').lean()).map(d => d.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 10000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

// Plain-text summary of HTML, cut at a word boundary.
export function excerptFromHtml(html, max = 160) {
  const plain = String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div|blockquote)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[\s,;:.–-]+$/, '') + '…';
}

export function listParams(req, { maxLimit = 100, defaultLimit = 20 } = {}) {
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, parseInt(sp.get('page'), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(sp.get('limit'), 10) || defaultLimit));
  const q = (sp.get('q') || '').trim().slice(0, 100);
  return { sp, page, limit, skip: (page - 1) * limit, q };
}

export function searchFilter(q, fields) {
  if (!q) return {};
  const re = { $regex: escapeRegex(q), $options: 'i' };
  return { $or: fields.map(f => ({ [f]: re })) };
}
