import { createHash } from 'node:crypto';
import { Product } from '../../models/Product.js';
import { ProductCategory } from '../../models/ProductCategory.js';

// Products on the website's product pages.
//
// The website's product pages show "cards" (name, photo, load class, a text with material, description, features
// and options) in groups: a tab or a titled block of a page, listed in site-schema.json as productGroups
// ({ id, page, path, label, cols, cards: [card ids] }). The 88 cards of the converted pages were imported into
// Products once (seed.js importProducts), each remembering its card (builtIn.card), a fingerprint of what the card
// showed (builtIn.fp) and its photo (builtIn.img).
//
// For the website, productGroupsForWebsite() lists only the groups whose products differ from the built-in cards
// (edited, added, removed, unpublished or moved): { [groupId]: [card items] }. Every other group stays exactly as
// the page was built.

const normPath = p => {
  const s = String(p || '').trim();
  if (!s) return '';
  return `/${s.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
};

// what a website card shows of a product
export function cardFingerprint(p) {
  const img = (p.images && p.images[0]) || null;
  const data = [
    p.name || '', p.loadClass || '', p.material || '', p.summary || '',
    Array.from(p.features || []), Array.from(p.options || []),
    Array.from(p.specs || []).map(s => [s.label || '', s.value || '']),
    img ? [img.url || '', img.alt || ''] : null,
  ];
  return createHash('sha1').update(JSON.stringify(data)).digest('base64url').slice(0, 20);
}

// the groups of one website page path, in page order
export function groupsByPath(groups) {
  const m = new Map();
  for (const g of groups || []) {
    const k = normPath(g.path);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(g);
  }
  return m;
}

// the group a product goes to: its own if it belongs to the page of its category, else that page's first group
export function groupFor(p, catPath, byId, byPath) {
  const own = p.group && byId.get(p.group);
  if (own && normPath(own.path) === catPath) return own;
  const list = byPath.get(catPath);
  return list && list.length ? list[0] : null;
}

function cardItem(p, g) {
  const own = Boolean(p.builtIn && p.builtIn.card && g.cards.includes(p.builtIn.card));
  const same = own && p.builtIn.fp === cardFingerprint(p);
  const item = { id: String(p._id), card: own ? p.builtIn.card : null, same };
  if (same) return item;
  const img = (p.images && p.images[0]) || null;
  Object.assign(item, {
    name: p.name || '', load: p.loadClass || '', material: p.material || '', summary: p.summary || '',
    features: Array.from(p.features || []), options: Array.from(p.options || []),
    specs: Array.from(p.specs || []).map(s => ({ label: s.label || '', value: s.value || '' })).filter(s => s.label && s.value),
  });
  if (!img) item.noImage = true;
  // an unchanged photo of a built-in card: the website keeps its own copy (sharper, in every size)
  else if (!(own && p.builtIn.img && img.url === p.builtIn.img)) item.image = { url: img.url, width: img.width || undefined, height: img.height || undefined, alt: img.alt || p.name || '' };
  return item;
}

// the published products of each group, in website order: Map groupId -> [lean products]
export async function productsInGroups(groups, { select = 'name category group order loadClass material summary features options specs images builtIn status' } = {}) {
  const lists = new Map((groups || []).map(g => [g.id, []]));
  if (!lists.size) return lists;
  const [products, cats] = await Promise.all([
    Product.find({ status: 'published' }).select(select).sort({ order: 1, name: 1, _id: 1 }).lean(),
    ProductCategory.find({}).select('websitePath').lean(),
  ]);
  const catPath = new Map(cats.map(c => [String(c._id), normPath(c.websitePath)]));
  const byId = new Map(groups.map(g => [g.id, g]));
  const byPath = groupsByPath(groups);
  for (const p of products) {
    const g = groupFor(p, catPath.get(String(p.category)) || '', byId, byPath);
    if (g) lists.get(g.id).push(p);
  }
  return lists;
}

// { [groupId]: [items] } for the groups that differ from the built-in cards, or null when none do
export async function productGroupsForWebsite(groups) {
  if (!Array.isArray(groups) || !groups.length) return null;
  const lists = await productsInGroups(groups);
  const out = {};
  for (const g of groups) {
    const items = lists.get(g.id).map(p => cardItem(p, g));
    const sameCards = items.length === g.cards.length && items.every((it, i) => it.same && it.card === g.cards[i]);
    if (!sameCards) out[g.id] = items;
  }
  return Object.keys(out).length ? out : null;
}

// ---- reading a card text saved in the website editor before the products were in the admin ----

const decode = s => String(s || '')
  .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

export function textOf(html) {
  return decode(html);
}

// { material, summary, features, options, specs } from a card text block (paragraphs, "Features"/"Options" headings
// as bold list items or bold paragraphs, list items, "Label: value" paragraphs)
export function cardFieldsFromHtml(html) {
  const f = { material: '', summary: [], features: [], options: [], specs: [] };
  let target = 'features';
  const blocks = String(html || '').match(/<(p|li|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const tag = b.match(/^<([a-z0-9]+)/i)[1].toLowerCase();
    const inner = b.replace(/^<[^>]+>/, '').replace(/<\/[a-z0-9]+>$/i, '');
    const t = decode(inner);
    if (!t) continue;
    const bold = /font-weight\s*:\s*bold/i.test(b.match(/^<[^>]+>/)[0]) || /^\s*<(strong|b)\b/i.test(inner);
    const head = t.replace(/:$/, '').trim().toLowerCase();
    if (bold && (head === 'features' || head === 'options')) { target = head; continue; }
    if (tag === 'li') { f[target].push(t); continue; }
    const m = inner.match(/^\s*<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>\s*([\s\S]*)$/i);
    if (m) {
      const label = decode(m[2]).replace(/:$/, '').trim();
      const value = decode(m[3]);
      if (label.toLowerCase() === 'material' && !f.material) { f.material = value; continue; }
      if (label && value) { f.specs.push({ label, value }); continue; }
    }
    f.summary.push(t);
  }
  return { ...f, summary: f.summary.join('\n\n') };
}
