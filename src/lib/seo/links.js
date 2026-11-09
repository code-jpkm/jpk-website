import { connectDB } from '../db.js';
import { HttpError } from '../errors.js';
import { SitePart, partData } from '../../models/SitePart.js';
import { Blog } from '../../models/Blog.js';
import { getSchema, sectionTypes } from '../site/schema.js';
import { savePart } from '../site/store.js';
import { cleanHref } from '../site/clean.js';
import { sanitizeRich } from '../sanitize.js';
import { scheduleSiteRebuild } from '../siteHook.js';
import { websiteUrl } from '../present.js';
import { anchors, setAnchor, unwrapAnchor, findWords, linkWords, plainText, escapeHtml } from './html.js';

// The links of the website, page by page (SEO › Links): where each link is, where it goes (a page of the website,
// an old address that is redirected, a missing page, another website), and changes to them: a new address or words,
// open in a new tab, nofollow, the link removed (its words stay), or words of a text made a link.
//
// A link is found by its place (loc):
//   { kind: 'linkField', field }            a button or linked item of a built-in page / the header or footer
//   { kind: 'field', field, a }             the a-th link inside a text or text block
//   { kind: 'builder', section, path, a? }  a section made in the admin: a button (path to it) or a link in a text
//   { kind: 'post', a }                     the a-th link in a JPK Updates post
//   { kind: 'fixed' }                       made by the page's design (product card buttons, the menu): not changed here
// Words to link are found in "texts" (the same places without a, see findPlaces).

const SITE_HOSTS = () => {
  const hosts = new Set(['jpkm.in', 'www.jpkm.in']);
  try { hosts.add(new URL(websiteUrl()).hostname.toLowerCase()); } catch { /* the default is enough */ }
  return hosts;
};

export function normPath(p) {
  let s = String(p || '').split(/[?#]/)[0].trim();
  if (!s.startsWith('/')) s = `/${s}`;
  s = s.replace(/\/{2,}/g, '/');
  if (!/\.[a-z0-9]{2,5}$/i.test(s) && !s.endsWith('/')) s += '/';
  return s;
}

// ---- everything needed to tell where links go ----

export async function siteIndex() {
  await connectDB();
  const { schema } = await getSchema();
  const parts = await SitePart.find({ kind: { $in: ['page', 'custom', 'global', 'seo'] } }).lean();
  const data = new Map(parts.map(p => [p.key, partData(p) || {}]));
  const posts = await Blog.find({ status: 'published' }).select('title slug content publishedAt').lean();
  const pages = new Map();
  for (const sp of schema.pages) {
    pages.set(normPath(sp.path), { key: `page:${sp.page}`, name: sp.name, kind: 'page', hidden: Boolean((data.get(`page:${sp.page}`) || {}).hidden) });
  }
  for (const p of parts.filter(x => x.kind === 'custom')) {
    const d = data.get(p.key) || {};
    if (d.path) pages.set(normPath(d.path), { key: p.key, name: d.title || 'New page', kind: 'custom', hidden: !d.published });
  }
  for (const post of posts) pages.set(normPath(`/jpk-updates/${post.slug}/`), { key: `post:${post._id}`, name: post.title, kind: 'post' });
  for (const p of schema.posts || []) if (!pages.has(normPath(p.path))) pages.set(normPath(p.path), { key: null, name: p.title, kind: 'post' });
  const redirects = new Map();
  for (const r of schema.redirects || []) redirects.set(normPath(r.from), r.to);
  for (const r of (data.get('seo') || {}).redirects || []) redirects.set(normPath(r.from), r.to);
  return { schema, data, parts, posts, pages, redirects, types: sectionTypes(schema), hosts: SITE_HOSTS() };
}

// where an address goes: { type: internal | external | contact | anchor, path?, status?, page?, to?, toName?, host? }
export function classify(href, idx) {
  const h = String(href || '').trim();
  if (!h || h.startsWith('#')) return { type: 'anchor' };
  if (/^(mailto|tel):/i.test(h)) return { type: 'contact' };
  let path;
  if (/^https?:\/\//i.test(h) || h.startsWith('//')) {
    let u;
    try { u = new URL(h.startsWith('//') ? `https:${h}` : h); } catch { return { type: 'external', host: '' }; }
    if (!idx.hosts.has(u.hostname.toLowerCase())) return { type: 'external', host: u.hostname.replace(/^www\./i, '') };
    path = u.pathname || '/';
  } else if (h.startsWith('/')) path = h;
  else return { type: 'external', host: '' };
  const p = normPath(path);
  if (/^\/(images|api\/files|fonts|assets)\//.test(p) || /\.[a-z0-9]{2,5}$/i.test(p)) return { type: 'internal', path: p, status: 'file' };
  const page = idx.pages.get(p);
  if (page) return { type: 'internal', path: p, status: page.hidden ? 'hidden' : 'ok', page: { key: page.key, name: page.name } };
  const to = idx.redirects.get(p);
  if (to) {
    const t = idx.pages.get(normPath(to));
    return { type: 'internal', path: p, status: 'redirect', to, toName: t ? t.name : '' };
  }
  return { type: 'internal', path: p, status: 'missing' };
}

// ---- the links of one page ----

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const sectionNames = sp => new Map((sp.sections || []).map(s => [s.id, s.note ? `${s.label} (${s.note})` : s.label]));

function builderSection(sec, def, name, add, addText, hidden) {
  const walk = (fields, data, path, label) => {
    for (const f of fields || []) {
      const v = isObj(data) ? data[f.key] : undefined;
      const where = label ? `${label} › ${f.label}` : f.label;
      if (f.type === 'link' && isObj(v) && v.href) {
        add({ loc: { kind: 'builder', section: sec.id, path: [...path, f.key] }, section: sec.id, sectionName: name, where, href: v.href, text: v.label || '', textEditable: true, newTab: Boolean(v.newTab), nofollow: Boolean(v.nofollow), canUnlink: true, unlinkLabel: 'Remove the button', hidden });
      } else if ((f.type === 'rich' || (f.type === 'textarea' && f.code)) && typeof v === 'string') {
        for (const a of anchors(v)) add({ loc: { kind: 'builder', section: sec.id, path: [...path, f.key], a: a.i }, section: sec.id, sectionName: name, where, href: a.href, text: a.text, picture: a.picture, textEditable: Boolean(a.text), newTab: a.newTab, nofollow: a.nofollow, canUnlink: true, hidden });
        if (f.type === 'rich') addText({ loc: { kind: 'builder', section: sec.id, path: [...path, f.key] }, section: sec.id, sectionName: name, where, html: v, hidden });
      } else if (f.type === 'list' && Array.isArray(v)) {
        v.forEach((item, i) => walk(f.fields, item, [...path, f.key, i], `${f.itemLabel || 'Item'} ${i + 1}`));
      }
    }
  };
  walk(def.fields, sec.data, [], '');
}

// { key, kind, name, path, links: [...], texts: [...] } or null; links in hidden sections carry hidden: true
export function linksOf(key, idx) {
  const links = [];
  const texts = [];
  const add = l => links.push(l);
  const addText = t => texts.push(t);
  const { schema } = idx;
  let info;
  if (key.startsWith('page:') || key === 'global') {
    const isGlobal = key === 'global';
    const sp = isGlobal ? null : schema.pages.find(p => p.page === key.slice(5));
    if (!isGlobal && !sp) return null;
    const d = idx.data.get(key) || {};
    const content = d.content || {};
    const fields = isGlobal ? schema.global.fields : sp.fields;
    const names = isGlobal ? new Map((schema.global.sections || []).map(s => [s.id, s.label])) : sectionNames(sp);
    const hiddenSecs = new Set((d.sections || []).filter(s => s.ref && s.hidden).map(s => s.ref));
    const cards = new Set(((sp && sp.products) || []).map(g => g.section));
    info = isGlobal ? { key, kind: 'global', name: 'Header and footer', path: '' } : { key, kind: 'page', name: sp.name, path: sp.path, hidden: Boolean(d.hidden) };
    for (const [k, f] of Object.entries(fields || {})) {
      const hidden = f.section ? hiddenSecs.has(f.section) : false;
      const base = { section: f.section || null, sectionName: names.get(f.section) || f.section || '', hidden };
      if (f.kind === 'link') {
        const v = isObj(content[k]) ? content[k] : null;
        const textField = f.of ? fields[f.of] : null;
        const textHtml = f.of ? (typeof content[f.of] === 'string' ? content[f.of] : (textField && textField.default) || '') : f.default || '';
        const img = String(textHtml).match(/<img\b[^>]*\balt\s*=\s*"([^"]*)"/i);
        add({ ...base, loc: { kind: 'linkField', field: k }, where: f.of ? 'Button or linked text' : img ? 'Linked picture' : 'Linked item', href: v && v.href ? v.href : f.href || '', text: plainText(textHtml), picture: img ? plainText(img[1]) : '', textEditable: Boolean(f.of && textField), newTab: v ? Boolean(v.newTab) : Boolean(f.newTab), nofollow: Boolean(v && v.nofollow), canUnlink: false });
      } else if (f.kind === 'text' || f.kind === 'rich') {
        const html = typeof content[k] === 'string' ? content[k] : f.default || '';
        const where = f.label || (f.kind === 'rich' ? 'Text block' : /^h[1-6]$/.test(f.tag || '') ? 'Heading' : 'Text');
        for (const a of anchors(html)) add({ ...base, loc: { kind: 'field', field: k, a: a.i }, where, href: a.href, text: a.text, picture: a.picture, textEditable: Boolean(a.text), newTab: a.newTab, nofollow: a.nofollow, canUnlink: true });
        if (!f.inLink && !f.link && f.tag !== 'a' && f.tag !== 'button' && plainText(html)) addText({ ...base, loc: { kind: 'field', field: k }, where, html, heading: /^h[1-6]$/.test(f.tag || '') });
      }
    }
    if (!isGlobal) {
      for (const s of d.sections || []) {
        if (s.ref || !idx.types[s.type]) continue;
        const def = idx.types[s.type];
        builderSection(s, def, `${def.label}${s.data && s.data.heading ? `: ${plainText(s.data.heading)}` : ''} (added)`, add, addText, Boolean(s.hidden));
      }
    }
    for (const l of (isGlobal ? schema.global.links : sp.links) || []) {
      const where = l.nav ? 'Menu' : !isGlobal && cards.has(l.section) ? 'Product card' : 'Part of the design';
      const sectionName = isGlobal ? (l.region === 'footer' ? 'Footer' : 'Header') : names.get(l.section) || '';
      add({ loc: { kind: 'fixed' }, section: l.section || l.region || null, sectionName, where, href: l.href, text: l.text || '', picture: l.picture || '', newTab: Boolean(l.newTab), nofollow: Boolean(l.nofollow), fixed: true, hidden: !isGlobal && l.section ? hiddenSecs.has(l.section) : false });
    }
  } else if (key.startsWith('custom:')) {
    const part = idx.parts.find(p => p.key === key);
    if (!part) return null;
    const d = idx.data.get(key) || {};
    info = { key, kind: 'custom', name: d.title || 'New page', path: d.path || '', hidden: !d.published };
    for (const s of d.sections || []) {
      const def = idx.types[s.type];
      if (!def) continue;
      builderSection(s, def, `${def.label}${s.data && s.data.heading ? `: ${plainText(s.data.heading)}` : ''}`, add, addText, Boolean(s.hidden));
    }
  } else if (key.startsWith('post:')) {
    const post = idx.posts.find(p => String(p._id) === key.slice(5));
    if (!post) return null;
    info = { key, kind: 'post', name: post.title, path: `/jpk-updates/${post.slug}/` };
    for (const a of anchors(post.content)) add({ loc: { kind: 'post', a: a.i }, section: null, sectionName: 'Post text', where: 'Text', href: a.href, text: a.text, picture: a.picture, textEditable: Boolean(a.text), newTab: a.newTab, nofollow: a.nofollow, canUnlink: true });
    addText({ loc: { kind: 'post' }, section: null, sectionName: 'Post text', where: 'Text', html: post.content || '' });
  } else return null;
  links.forEach((l, i) => Object.assign(l, { id: i, ...classify(l.href, idx) }));
  return { ...info, links, texts };
}

const counted = l => !l.hidden && (l.type === 'internal' || l.type === 'external');

// counts of one page's links (the header and footer are counted separately)
export function linkCounts(info) {
  const c = { internal: 0, external: 0, contact: 0, nofollow: 0, problems: 0, total: 0 };
  for (const l of info.links) {
    if (l.hidden) continue;
    if (l.type === 'internal') c.internal += 1;
    if (l.type === 'external') c.external += 1;
    if (l.type === 'contact') c.contact += 1;
    if (counted(l) && l.nofollow) c.nofollow += 1;
    if (l.type === 'internal' && ['missing', 'redirect', 'hidden'].includes(l.status)) c.problems += 1;
  }
  c.total = c.internal + c.external;
  return c;
}

// every page, post and the header/footer: { rows, inbound: Map(path -> [{ key, name }]) }
export async function linksOverview() {
  const idx = await siteIndex();
  const keys = [
    ...idx.schema.pages.map(p => `page:${p.page}`),
    ...idx.parts.filter(p => p.kind === 'custom').map(p => p.key),
    ...idx.posts.map(p => `post:${p._id}`),
  ];
  const infos = keys.map(k => linksOf(k, idx)).filter(Boolean);
  const inbound = new Map();
  for (const info of infos) {
    if (info.hidden) continue;
    const seen = new Set();
    for (const l of info.links) {
      if (l.hidden || l.type !== 'internal' || seen.has(l.path) || l.path === normPath(info.path)) continue;
      seen.add(l.path);
      if (!inbound.has(l.path)) inbound.set(l.path, []);
      inbound.get(l.path).push({ key: info.key, name: info.name });
    }
  }
  const global = linksOf('global', idx);
  const inMenu = new Set(((global && global.links) || []).filter(l => l.where === 'Menu' && l.type === 'internal').map(l => l.path));
  const rows = infos.map(info => ({
    key: info.key, kind: info.kind, name: info.name, path: info.path, hidden: Boolean(info.hidden),
    ...linkCounts(info), inbound: (inbound.get(normPath(info.path)) || []).length, inMenu: inMenu.has(normPath(info.path)),
  }));
  return { rows, global: global ? { ...linkCounts(global), key: 'global', name: global.name } : null, idx, inbound };
}

// one page with its links, the pages linking to it, places to put new links and suggestions
export async function pageLinks(key) {
  const { rows, inbound, idx } = await linksOverview();
  const info = linksOf(key, idx);
  if (!info) return null;
  const targets = [...idx.pages.entries()].filter(([, p]) => p.key && !p.hidden).map(([path, p]) => ({ path, name: p.name, kind: p.kind })).sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'post' ? 1 : -1));
  const suggestions = key === 'global' ? [] : linkSuggestions(info, idx, rows);
  const { texts, ...rest } = info;
  return {
    ...rest, counts: linkCounts(info), linkedFrom: key === 'global' ? [] : (inbound.get(normPath(info.path)) || []).filter(x => x.key !== key),
    targets, suggestions, canAdd: texts.some(t => !t.hidden),
  };
}

// ---- suggestions: words on this page that name another page which this page does not link to yet ----

function linkSuggestions(info, idx, rows) {
  const linked = new Set(info.links.filter(l => l.type === 'internal').map(l => l.path));
  const own = normPath(info.path);
  const cands = [];
  for (const sp of idx.schema.pages) {
    const path = normPath(sp.path);
    if (path === own || path === '/' || linked.has(path)) continue;
    const d = idx.data.get(`page:${sp.page}`) || {};
    if (d.hidden) continue;
    const seo = d.seo || {};
    const phrases = [seo.focus, ...(seo.keyphrases || [])].filter(Boolean);
    if (String(sp.name).trim().split(/\s+/).length >= 2) phrases.push(sp.name);
    cands.push({ path, name: sp.name, phrases });
  }
  for (const r of rows.filter(x => x.kind === 'custom' && !x.hidden)) {
    const path = normPath(r.path);
    if (path === own || linked.has(path)) continue;
    const seo = (idx.data.get(r.key) || {}).seo || {};
    cands.push({ path, name: r.name, phrases: [seo.focus, ...(seo.keyphrases || []), r.name.split(/\s+/).length >= 2 ? r.name : ''].filter(Boolean) });
  }
  const out = [];
  const places = info.texts.filter(t => !t.hidden && !t.heading);
  for (const c of cands) {
    let done = false;
    for (const phrase of c.phrases) {
      for (const t of places) {
        const hit = findWords(t.html, phrase, { limit: 1 })[0];
        if (!hit) continue;
        out.push({ phrase, to: c.path, name: c.name, place: { loc: t.loc, start: hit.start, end: hit.end, match: hit.match }, before: hit.before, after: hit.after, sectionName: t.sectionName });
        done = true;
        break;
      }
      if (done) break;
    }
    if (out.length >= 12) break;
  }
  return out;
}

// places on the page where the words appear (outside links): [{ loc, start, end, match, before, after, sectionName, where }]
export async function findPlaces(key, words) {
  const idx = await siteIndex();
  const info = linksOf(key, idx);
  if (!info) return null;
  const out = [];
  for (const t of info.texts) {
    if (t.hidden) continue;
    for (const hit of findWords(t.html, words, { limit: 20 })) {
      out.push({ loc: t.loc, start: hit.start, end: hit.end, match: hit.match, before: hit.before, after: hit.after, sectionName: t.sectionName, where: t.where, heading: Boolean(t.heading) });
      if (out.length >= 40) return out;
    }
  }
  return out;
}

// ---- changing links ----

function pathGet(obj, path) {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function pathSet(obj, path, value) {
  const last = path[path.length - 1];
  const parent = pathGet(obj, path.slice(0, -1));
  if (parent == null || typeof parent !== 'object') throw new HttpError(409, 'This link is no longer on the page. Reload to see the page as it is now.');
  if (value === undefined) delete parent[last]; else parent[last] = value;
}

const validPath = p => Array.isArray(p) && p.length > 0 && p.length < 12 && p.every(x => (typeof x === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(x)) || (Number.isInteger(x) && x >= 0 && x < 500));

function cleanNewHref(href) {
  const h = cleanHref(href);
  if (!h) throw new HttpError(400, 'Enter where the link goes: choose a page, or type a web address such as https://example.com.');
  return h;
}
const sameText = (a, b) => String(a || '').replace(/\s+/g, ' ').trim().toLowerCase() === String(b || '').replace(/\s+/g, ' ').trim().toLowerCase();
const changedMeanwhile = () => new HttpError(409, 'This link was changed meanwhile (here or in Pages & sections). Reload the list to see it as it is now.');

// op: 'edit' { loc, expect: { href, text }, href, text, newTab, nofollow } | 'unlink' { loc, expect } |
//     'add' { place: { loc, start, end, match }, href, newTab, nofollow }
export async function changeLink(key, body, user) {
  const op = body && body.op;
  if (!['edit', 'unlink', 'add'].includes(op)) throw new HttpError(400, 'Unknown change.');
  const loc = op === 'add' ? body.place && body.place.loc : body.loc;
  if (!isObj(loc)) throw new HttpError(400, 'Which link?');
  const opts = { newTab: Boolean(body.newTab), nofollow: Boolean(body.nofollow) };
  const href = op === 'unlink' ? null : cleanNewHref(body.href);
  const expect = isObj(body.expect) ? body.expect : null;
  const checkA = a => {
    if (!a || (expect && (a.href !== expect.href || !sameText(a.text, expect.text)))) throw changedMeanwhile();
  };
  // one text's HTML -> the changed HTML
  const changeHtml = (html, a) => {
    if (op === 'add') {
      const out = linkWords(html, body.place, { href, ...opts });
      if (out === null) throw new HttpError(409, 'These words are no longer at this place (or are already a link). Search again.');
      return out;
    }
    if (!Number.isInteger(a)) throw new HttpError(400, 'Which link?');
    checkA(anchors(html)[a]);
    return op === 'unlink' ? unwrapAnchor(html, a) : setAnchor(html, a, { href, text: body.text, ...opts });
  };

  await connectDB();
  if (key.startsWith('post:')) {
    if (loc.kind !== 'post') throw new HttpError(400, 'Which link?');
    const post = await Blog.findById(key.slice(5));
    if (!post) throw new HttpError(404, 'This post no longer exists.');
    post.content = sanitizeRich(changeHtml(post.content || '', loc.a));
    post.updatedBy = user.id;
    await post.save();
    if (post.status === 'published') scheduleSiteRebuild('link changed in a JPK Updates post');
    return { ok: true };
  }

  const { schema } = await getSchema();
  const types = sectionTypes(schema);
  const part = await SitePart.findOne({ key }).lean();
  const d = part ? JSON.parse(JSON.stringify(partData(part) || {})) : {};
  if (key.startsWith('custom:') && !part) throw new HttpError(404, 'This page no longer exists.');
  const isGlobal = key === 'global';
  const sp = key.startsWith('page:') ? schema.pages.find(p => p.page === key.slice(5)) : null;
  if (key.startsWith('page:') && !sp) throw new HttpError(404, 'This page is not part of the website (any more).');
  const fields = isGlobal ? schema.global.fields : sp ? sp.fields : {};
  d.content = isObj(d.content) ? d.content : {};

  if (loc.kind === 'linkField') {
    if (op === 'add') throw new HttpError(400, 'Choose words in a text to make a link.');
    const f = fields[loc.field];
    if (!f || f.kind !== 'link') throw changedMeanwhile();
    if (op === 'unlink') throw new HttpError(400, 'A button always goes somewhere: give it another address, or hide its section in Pages & sections.');
    const cur = isObj(d.content[loc.field]) ? d.content[loc.field] : { href: f.href };
    if (expect && (cur.href || f.href) !== expect.href) throw changedMeanwhile();
    d.content[loc.field] = { href, ...(opts.newTab ? { newTab: true } : {}), ...(opts.nofollow ? { nofollow: true } : {}) };
    if (body.text !== undefined && f.of && fields[f.of] && String(body.text).trim()) {
      const now = typeof d.content[f.of] === 'string' ? d.content[f.of] : fields[f.of].default || '';
      if (!sameText(plainText(now), body.text)) d.content[f.of] = escapeHtml(String(body.text).trim());
    }
  } else if (loc.kind === 'field') {
    const f = fields[loc.field];
    if (!f || (f.kind !== 'text' && f.kind !== 'rich')) throw changedMeanwhile();
    if (op === 'add' && (f.inLink || f.link || f.tag === 'a')) throw new HttpError(400, 'These words are already a link.');
    const html = typeof d.content[loc.field] === 'string' ? d.content[loc.field] : f.default || '';
    d.content[loc.field] = changeHtml(html, loc.a);
  } else if (loc.kind === 'builder') {
    if (!validPath(loc.path)) throw new HttpError(400, 'Which link?');
    const sec = (d.sections || []).find(s => !s.ref && s.id === loc.section);
    if (!sec || !types[sec.type]) throw changedMeanwhile();
    sec.data = isObj(sec.data) ? sec.data : {};
    const v = pathGet(sec.data, loc.path);
    if (op !== 'add' && loc.a === undefined) {
      if (!isObj(v) || (expect && v.href !== expect.href)) throw changedMeanwhile();
      if (op === 'unlink') pathSet(sec.data, loc.path, undefined);
      else pathSet(sec.data, loc.path, { ...v, href, label: body.text !== undefined && String(body.text).trim() ? String(body.text).trim().slice(0, 120) : v.label, newTab: opts.newTab || undefined, nofollow: opts.nofollow || undefined });
    } else {
      if (typeof v !== 'string') throw changedMeanwhile();
      pathSet(sec.data, loc.path, changeHtml(v, loc.a));
    }
  } else throw new HttpError(400, 'This link is part of the page design and is changed elsewhere.');

  await savePart(key, d, user, { reason: 'link changed' });
  return { ok: true };
}
