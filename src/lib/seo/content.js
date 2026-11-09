import { connectDB } from '../db.js';
import { SitePart, partData } from '../../models/SitePart.js';
import { Blog } from '../../models/Blog.js';
import { getSchema } from '../site/schema.js';
import { productsInGroups } from '../products/website.js';
import { analyzePage } from './analyze.js';
import { siteIndex, linksOf, linkCounts } from './links.js';

// What the SEO check reads from a page: its texts (in page order: headings, paragraphs, list items), pictures and
// links as the website shows them (built-in content, the website editor's changes, sections added in the admin, the
// products of product pages). Elementor pages often have a computer and a phone copy of the same text: repeated
// paragraphs are counted once.

const decode = s => String(s || '')
  .replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|li|h[1-6]|div)>/gi, ' ').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

// the blocks of a piece of HTML: [{ tag, text }]
function blocksOf(html) {
  const h = String(html || '');
  const out = [];
  const re = /<(h[1-6]|p|li|blockquote|td|th|figcaption|dt|dd)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  let any = false;
  while ((m = re.exec(h))) {
    any = true;
    const t = decode(m[2]);
    if (t) out.push({ tag: /^h[1-6]$/i.test(m[1]) ? m[1].toLowerCase() : m[1].toLowerCase() === 'li' ? 'li' : 'p', text: t });
  }
  if (!any) { const t = decode(h); if (t) out.push({ tag: 'p', text: t }); }
  return out;
}

function imagesOf(html, out) {
  for (const m of String(html || '').matchAll(/<img\b[^>]*>/gi)) {
    const a = m[0].match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const alt = a ? String(a[1] ?? a[2] ?? '').trim() : '';
    if (a && !alt) continue; // alt="" marks a decorative picture (nothing to describe); no alt at all is a missing description
    out.images.push({ alt });
  }
}

// texts and pictures in a section made in the admin (any section type)
function fromBuilder(data, out, depth = 0) {
  if (depth > 6 || data == null) return;
  if (Array.isArray(data)) { for (const x of data) fromBuilder(x, out, depth + 1); return; }
  if (typeof data !== 'object') return;
  if (typeof data.url === 'string' && (data.width || data.height || 'alt' in data)) { out.images.push({ alt: String(data.alt || '') }); return; }
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') {
      if (/^(href|link|url|to|button(Link|Href)?|type|id|style|variant|align|layout|icon|color|category|video|map|embed|anchor|background|spacing|width|height|columns|shade|textColor|imageSide|shape|size|count|button)$/i.test(k)) continue;
      if (/^(heading|title|name|question)$/i.test(k)) { const t = decode(v); if (t) out.blocks.push({ tag: /^(heading)$/i.test(k) ? 'h2' : 'h3', text: t }); continue; }
      if (/<[a-z][^>]*>/i.test(v)) { out.blocks.push(...blocksOf(v)); imagesOf(v, out); continue; }
      for (const para of v.split(/\n\s*\n/)) { const t = decode(para); if (t) out.blocks.push({ tag: 'p', text: t }); }
    } else if (v && typeof v === 'object' && !v.href) {
      fromBuilder(v, out, depth + 1);
    }
  }
}

const empty = () => ({ blocks: [], images: [], links: [] });
const key = t => t.toLowerCase().replace(/\s+/g, ' ').trim();
function finish(o) {
  const seen = new Set();
  const blocks = o.blocks.filter(b => {
    if (b.text.split(' ').length < 5) return true;
    const k = `${b.tag[0] === 'h' ? 'h' : 'p'}:${key(b.text)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    blocks, text: blocks.map(b => b.text).join(' '),
    headings: [...new Set(blocks.filter(b => /^h[1-6]$/.test(b.tag)).map(b => b.text))],
    images: o.images, links: o.links,
  };
}

// a built-in page of the website, with its saved changes (d = the page's saved data)
export async function builtInPageInput(sp, d, { products } = {}) {
  const o = empty();
  const content = (d && d.content) || {};
  const sections = Array.isArray(d && d.sections) ? d.sections : null;
  const hidden = new Set((sections || []).filter(s => s.ref && s.hidden).map(s => s.ref));
  const cardSections = new Set((sp.products || []).map(g => g.section));
  const builder = new Map((sections || []).filter(s => !s.ref).map(s => [s.id, s]));
  // the page's own sections in their (saved) order, with the sections added in the admin between them
  const order = sections ? sections.map(s => s.ref || s.id) : (sp.sections || []).map(s => s.id);
  for (const id of (sp.sections || []).map(s => s.id)) if (!order.includes(id)) order.push(id);
  const bySection = new Map();
  for (const [k, f] of Object.entries(sp.fields || {})) {
    const s = f.section || '';
    if (!bySection.has(s)) bySection.set(s, []);
    bySection.get(s).push([k, f]);
  }
  const addFields = list => {
    for (const [k, f] of list) {
      const v = content[k];
      if (f.kind === 'text' || f.kind === 'rich') {
        const html = typeof v === 'string' ? v : f.default;
        if (f.kind === 'rich') { o.blocks.push(...blocksOf(html)); imagesOf(html, o); continue; }
        const t = decode(html);
        if (!t) continue;
        o.blocks.push({ tag: /^h[1-6]$/.test(f.tag || '') ? f.tag : f.tag === 'li' ? 'li' : 'p', text: t });
      } else if (f.kind === 'image') {
        // as the website shows it: the description given in the editor, else the built-in one. The built-in pictures
        // without one are decorative on purpose (icons, check marks: alt=""), so they are not counted.
        const alt = String((v && typeof v === 'object' && v.alt) || f.alt || '').trim();
        if (alt) o.images.push({ alt });
      }
    }
  };
  addFields(bySection.get('') || []);
  for (const id of order) {
    if (hidden.has(id)) continue;
    const b = builder.get(id);
    if (b) { if (!b.hidden && b.data) fromBuilder(b.data, o); continue; }
    addFields(bySection.get(id) || []);
    // the product cards of a product page come from Products
    if (cardSections.has(id)) {
      const groups = new Set((sp.products || []).filter(g => g.section === id).map(g => g.group));
      for (const p of (products || []).filter(x => groups.has(x.group))) {
        o.blocks.push({ tag: 'h3', text: p.name });
        if (p.material) o.blocks.push({ tag: 'p', text: `Material: ${p.material}` });
        if (p.summary) o.blocks.push(...String(p.summary).split(/\n\s*\n/).map(t => ({ tag: 'p', text: t.trim() })).filter(b => b.text));
        for (const x of [...(p.features || []), ...(p.options || [])]) o.blocks.push({ tag: 'li', text: x });
        for (const x of p.specs || []) o.blocks.push({ tag: 'li', text: `${x.label}: ${x.value}` });
        if (p.images && p.images[0]) o.images.push({ alt: p.images[0].alt || '' });
      }
    }
  }
  return finish(o);
}

export function customPageInput(d) {
  const o = empty();
  for (const s of (d && d.sections) || []) if (!s.hidden && s.data) fromBuilder(s.data, o);
  return finish(o);
}

export function postInput(post) {
  const o = empty();
  if (post.coverImage) o.images.push({ alt: post.coverImage.alt || '' });
  if (post.excerpt) o.blocks.push({ tag: 'p', text: post.excerpt });
  o.blocks.push(...blocksOf(post.content));
  imagesOf(post.content, o);
  return finish(o);
}

// the links the SEO check counts: those of the page's content (not hidden), as the link list shows them
function contentLinks(info) {
  if (!info) return [];
  return info.links.filter(l => !l.hidden && (l.type === 'internal' || l.type === 'external')).map(l => ({ href: l.href, type: l.type, nofollow: l.nofollow }));
}

// ---- the pages for the SEO overview and the SEO editor ----

const BRAND = ' | JPK Metallics';
const keyphrasesOf = seo => [seo && seo.focus, ...((seo && seo.keyphrases) || [])].map(k => String(k || '').trim()).filter(Boolean);

// every page with what Google sees and the SEO check: [{ key, kind, name, path, title, description, focus, noindex,
// hidden, score, points, readability, internal, external, href }]
export async function seoOverview() {
  await connectDB();
  const { schema } = await getSchema();
  const idx = await siteIndex();
  const parts = idx.parts.filter(p => p.kind === 'page' || p.kind === 'custom');
  const saved = idx.data;
  const lists = await productsInGroups(schema.productGroups || []);
  const rows = [];
  for (const sp of schema.pages) {
    const d = saved.get(`page:${sp.page}`) || {};
    const seo = d.seo || {};
    const products = (sp.products || []).flatMap(g => (lists.get(g.group) || []).map(p => ({ ...p, group: g.group })));
    rows.push({ key: `page:${sp.page}`, kind: 'page', name: sp.name, path: sp.path, hidden: Boolean(d.hidden), seo, defaults: sp.seo || {}, input: await builtInPageInput(sp, d, { products }), href: `/admin/website/seo/${sp.page}` });
  }
  for (const p of parts.filter(x => x.kind === 'custom')) {
    const d = saved.get(p.key) || {};
    rows.push({ key: p.key, kind: 'custom', name: d.title || p.title || 'New page', path: d.path || p.path || '', hidden: !d.published, seo: d.seo || {}, defaults: { title: `${d.title || ''}${BRAND}`, description: '', h1: d.title || '' }, input: customPageInput(d), href: `/admin/website/seo/custom-${p.key.slice(7)}` });
  }
  const posts = await Blog.find({ status: 'published' }).select('title slug excerpt content coverImage seoTitle seoDescription').lean();
  for (const post of posts) {
    rows.push({ key: `post:${post._id}`, kind: 'post', name: post.title, path: `/jpk-updates/${post.slug}/`, hidden: false, seo: { title: post.seoTitle, description: post.seoDescription }, defaults: { title: `${post.title} | JPK Updates – JPK Metallics`, description: post.excerpt || '', h1: post.title }, input: postInput(post), href: `/admin/blogs/${post._id}` });
  }
  return rows.map(r => {
    const info = linksOf(r.key, idx);
    r.input.links = contentLinks(info);
    const others = rows.filter(x => x !== r).flatMap(x => keyphrasesOf(x.seo).map(k => ({ name: x.name, keyphrase: k })));
    const a = analyzePage({ ...pageForAnalysis(r), otherFocus: others });
    const counts = info ? linkCounts(info) : { internal: 0, external: 0 };
    return {
      key: r.key, kind: r.kind, name: r.name, path: r.path, hidden: r.hidden, href: r.href,
      title: (r.seo && r.seo.title) || r.defaults.title || '', description: (r.seo && r.seo.description) || r.defaults.description || '',
      focus: String((r.seo && r.seo.focus) || '').trim(), keyphrases: (r.seo && r.seo.keyphrases) || [], noindex: Boolean(r.seo && r.seo.noindex),
      score: a.score, points: a.points, percent: a.points, readability: a.readability.score, flesch: a.readability.flesch,
      bad: a.checks.filter(c => c.status === 'bad' && c.weight).length, words: a.wordCount, internal: counts.internal, external: counts.external,
    };
  });
}

export function pageForAnalysis(r) {
  const seo = r.seo || {};
  return {
    keyphrase: seo.focus || '', keyphrases: seo.keyphrases || [], title: seo.title || r.defaults.title || '', description: seo.description || r.defaults.description || '',
    path: r.path, h1: seo.h1 || r.defaults.h1 || '', headings: r.input.headings, blocks: r.input.blocks, text: r.input.text, images: r.input.images, links: r.input.links,
    noindex: Boolean(seo.noindex),
  };
}

// one page for the SEO editor: key "page:<Page>" or "custom:<id>"
export async function seoPage(key) {
  await connectDB();
  const { schema } = await getSchema();
  const idx = await siteIndex();
  const part = await SitePart.findOne({ key }).lean();
  const d = part ? partData(part) || {} : {};
  let row = null;
  if (key.startsWith('page:')) {
    const sp = schema.pages.find(p => p.page === key.slice(5));
    if (!sp) return null;
    const lists = await productsInGroups(schema.productGroups || []);
    const products = (sp.products || []).flatMap(g => (lists.get(g.group) || []).map(p => ({ ...p, group: g.group })));
    row = { key, kind: 'page', name: sp.name, path: sp.path, hidden: Boolean(d.hidden), seo: d.seo || {}, defaults: sp.seo || {}, input: await builtInPageInput(sp, d, { products }) };
  } else if (key.startsWith('custom:')) {
    if (!part) return null;
    row = { key, kind: 'custom', name: d.title || 'New page', path: d.path || '', hidden: !d.published, seo: d.seo || {}, defaults: { title: `${d.title || ''}${BRAND}`, description: '', h1: d.title || '' }, input: customPageInput(d) };
  } else return null;
  const info = linksOf(key, idx);
  row.input.links = contentLinks(info);
  // the other pages' keyphrases (each page should have its own)
  const otherFocus = [];
  for (const p of idx.parts) {
    if (p.key === key || (p.kind !== 'page' && p.kind !== 'custom')) continue;
    const x = partData(p) || {};
    const name = p.kind === 'page' ? ((schema.pages.find(sp => sp.page === p.key.slice(5)) || {}).name || p.key.slice(5)) : x.title || p.title || 'a page';
    for (const k of keyphrasesOf(x.seo)) otherFocus.push({ name, keyphrase: k });
  }
  return { ...row, otherFocus, links: info ? linkCounts(info) : null, part: { data: part ? d : null, updatedAt: part ? part.updatedAt : null } };
}

// every page's keyphrases, for SEO › Rankings: [{ key, name, path, keyphrase, main }]
export async function keyphraseList() {
  await connectDB();
  const { schema } = await getSchema();
  const parts = await SitePart.find({ kind: { $in: ['page', 'custom'] } }).lean();
  const out = [];
  for (const p of parts) {
    const d = partData(p) || {};
    const sp = p.kind === 'page' ? schema.pages.find(x => x.page === p.key.slice(5)) : null;
    if (p.kind === 'page' && !sp) continue;
    const name = sp ? sp.name : d.title || 'New page';
    const path = sp ? sp.path : d.path || '';
    keyphrasesOf(d.seo).forEach((k, i) => out.push({ key: p.key, name, path, keyphrase: k, main: i === 0 && Boolean(d.seo && d.seo.focus) }));
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
