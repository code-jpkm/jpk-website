import { connectDB } from '../db.js';
import { SitePart, partData } from '../../models/SitePart.js';
import { Blog } from '../../models/Blog.js';
import { getSchema } from '../site/schema.js';
import { productsInGroups } from '../products/website.js';
import { analyzePage } from './analyze.js';

// What the SEO check reads from a page: its texts, headings, pictures and links as the website shows them (built-in
// content, the website editor's changes, sections added in the admin, the products of product pages).

const decode = s => String(s || '')
  .replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|li|h[1-6]|div)>/gi, ' ').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

function fromHtml(html, out) {
  const h = String(html || '');
  for (const m of h.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) out.headings.push(decode(m[2]));
  for (const m of h.matchAll(/<img\b[^>]*>/gi)) {
    const a = m[0].match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const alt = a ? String(a[1] ?? a[2] ?? '').trim() : '';
    if (a && !alt) continue; // alt="" marks a decorative picture (nothing to describe); no alt at all is a missing description
    out.images.push({ alt });
  }
  for (const m of h.matchAll(/<a\b[^>]*\bhref\s*=\s*"([^"]+)"/gi)) out.links.push({ href: m[1] });
  const t = decode(h);
  if (t) out.text.push(t);
}

// texts, pictures and links in a section made in the admin (any section type)
function fromBuilder(data, out, depth = 0) {
  if (depth > 6 || data == null) return;
  if (Array.isArray(data)) { for (const x of data) fromBuilder(x, out, depth + 1); return; }
  if (typeof data !== 'object') return;
  if (typeof data.url === 'string' && (data.width || data.height || 'alt' in data)) { out.images.push({ alt: String(data.alt || '') }); return; }
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') {
      if (/^(href|link|url|to|button(Link|Href)?)$/i.test(k)) { if (/^(\/|https?:\/\/)/i.test(v)) out.links.push({ href: v }); continue; }
      if (/^(heading|title)$/i.test(k)) { const t = decode(v); if (t) { out.headings.push(t); out.text.push(t); } continue; }
      if (/^(type|id|style|variant|align|layout|icon|color|category|video|map|embed)$/i.test(k)) continue;
      fromHtml(v, out);
    } else if (v && typeof v === 'object') {
      if (v.href && typeof v.href === 'string') out.links.push({ href: v.href });
      fromBuilder(v, out, depth + 1);
    }
  }
}

const empty = () => ({ text: [], headings: [], images: [], links: [] });
const finish = o => ({ text: o.text.join(' '), headings: o.headings.filter(Boolean), images: o.images, links: o.links });

// a built-in page of the website, with its saved changes (d = the page's saved data)
export async function builtInPageInput(sp, d, { products } = {}) {
  const o = empty();
  const content = (d && d.content) || {};
  const sections = Array.isArray(d && d.sections) ? d.sections : null;
  const hidden = new Set((sections || []).filter(s => s.ref && s.hidden).map(s => s.ref));
  for (const [key, f] of Object.entries(sp.fields || {})) {
    if (f.section && hidden.has(f.section)) continue;
    const v = content[key];
    if (f.kind === 'text' || f.kind === 'rich') {
      const html = typeof v === 'string' ? v : f.default;
      const t = decode(html);
      if (!t) continue;
      if (/^h[1-6]$/.test(f.tag || '')) o.headings.push(t);
      if (f.kind === 'rich') fromHtml(html, o); else o.text.push(t);
    } else if (f.kind === 'image') {
      // as the website shows it: the description given in the editor, else the built-in one. The built-in pictures
      // without one are decorative on purpose (icons, check marks: alt=""), so they are not counted.
      const alt = String((v && typeof v === 'object' && v.alt) || f.alt || '').trim();
      if (alt) o.images.push({ alt });
    } else if (f.kind === 'link') {
      const href = v && typeof v === 'object' && v.href ? v.href : f.href;
      if (href) o.links.push({ href });
    }
  }
  for (const s of sections || []) if (!s.ref && !s.hidden && s.data) fromBuilder(s.data, o);
  // the product cards of a product page come from Products
  for (const p of products || []) {
    o.text.push([p.name, p.loadClass, p.material ? `Material: ${p.material}` : '', p.summary, ...(p.features || []), ...(p.options || []), ...(p.specs || []).map(x => `${x.label}: ${x.value}`)].filter(Boolean).join(' '));
    o.headings.push(p.name);
    if (p.images && p.images[0]) o.images.push({ alt: p.images[0].alt || '' });
    o.links.push({ href: '/contact-us/' });
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
  if (post.excerpt) o.text.push(post.excerpt);
  fromHtml(post.content, o);
  return finish(o);
}

// ---- the pages for the SEO overview and the SEO editor ----

const BRAND = ' | JPK Metallics';

// every page with what Google sees and the SEO check: [{ key, kind, name, path, title, description, focus, noindex,
// hidden, score, percent, bad, href }]
export async function seoOverview() {
  await connectDB();
  const { schema } = await getSchema();
  const parts = await SitePart.find({ kind: { $in: ['page', 'custom'] } }).lean();
  const saved = new Map(parts.map(p => [p.key, partData(p) || {}]));
  const lists = await productsInGroups(schema.productGroups || []);
  const rows = [];
  for (const sp of schema.pages) {
    const d = saved.get(`page:${sp.page}`) || {};
    const seo = d.seo || {};
    const products = (sp.products || []).flatMap(g => lists.get(g.group) || []);
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
  const focusOf = r => String((r.seo && r.seo.focus) || '').trim();
  return rows.map(r => {
    const others = rows.filter(x => x !== r && focusOf(x)).map(x => ({ name: x.name, keyphrase: focusOf(x) }));
    const a = analyzePage({ ...pageForAnalysis(r), otherFocus: others });
    return {
      key: r.key, kind: r.kind, name: r.name, path: r.path, hidden: r.hidden, href: r.href,
      title: (r.seo && r.seo.title) || r.defaults.title || '', description: (r.seo && r.seo.description) || r.defaults.description || '',
      focus: focusOf(r), noindex: Boolean(r.seo && r.seo.noindex), score: a.score, percent: a.percent,
      bad: a.checks.filter(c => c.status === 'bad').length, words: a.wordCount,
    };
  });
}

export function pageForAnalysis(r) {
  const seo = r.seo || {};
  return {
    keyphrase: seo.focus || '', title: seo.title || r.defaults.title || '', description: seo.description || r.defaults.description || '',
    path: r.path, h1: seo.h1 || r.defaults.h1 || '', headings: r.input.headings, text: r.input.text, images: r.input.images, links: r.input.links,
    noindex: Boolean(seo.noindex),
  };
}

// one page for the SEO editor: key "page:<Page>" or "custom:<id>"
export async function seoPage(key) {
  await connectDB();
  const { schema } = await getSchema();
  const part = await SitePart.findOne({ key }).lean();
  const d = part ? partData(part) || {} : {};
  let row = null;
  if (key.startsWith('page:')) {
    const sp = schema.pages.find(p => p.page === key.slice(5));
    if (!sp) return null;
    const lists = await productsInGroups(schema.productGroups || []);
    const products = (sp.products || []).flatMap(g => lists.get(g.group) || []);
    row = { key, kind: 'page', name: sp.name, path: sp.path, hidden: Boolean(d.hidden), seo: d.seo || {}, defaults: sp.seo || {}, input: await builtInPageInput(sp, d, { products }) };
  } else if (key.startsWith('custom:')) {
    if (!part) return null;
    row = { key, kind: 'custom', name: d.title || 'New page', path: d.path || '', hidden: !d.published, seo: d.seo || {}, defaults: { title: `${d.title || ''}${BRAND}`, description: '', h1: d.title || '' }, input: customPageInput(d) };
  } else return null;
  // the other pages' focus keyphrases (each page should have its own)
  const parts = await SitePart.find({ kind: { $in: ['page', 'custom'] }, key: { $ne: key } }).lean();
  const otherFocus = [];
  for (const p of parts) {
    const x = partData(p) || {};
    const f = x.seo && x.seo.focus;
    if (!f) continue;
    const name = p.kind === 'page' ? ((schema.pages.find(sp => sp.page === p.key.slice(5)) || {}).name || p.key.slice(5)) : x.title || p.title || 'a page';
    otherFocus.push({ name, keyphrase: f });
  }
  return { ...row, otherFocus, part: { data: part ? d : null, updatedAt: part ? part.updatedAt : null } };
}
