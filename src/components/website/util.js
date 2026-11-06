// Helpers for the website editor (no React).

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#x2F': '/', '#47': '/' };
export function decode(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (ENTITIES[e] !== undefined) return ENTITIES[e];
    if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (/^#/.test(e)) return String.fromCodePoint(parseInt(e.slice(1), 10));
    return m;
  });
}
const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// a line of text as the website shows it (HTML) <-> as typed in a text box
export function htmlToText(html) {
  return decode(String(html || '').replace(/<br\s*\/?>\s*/gi, '\n').replace(/<[^>]+>/g, '')).replace(/ /g, ' ');
}
export function textToHtml(text) {
  return escapeHtml(String(text || '')).replace(/\r?\n/g, '<br/>');
}
// does a text have formatting a plain text box would lose (links, bold…)? Line breaks are fine.
export function hasFormatting(html) {
  return /<(?!br\b)[a-z]/i.test(String(html || ''));
}
// the small formatting editor works with paragraphs; a line of text has line breaks instead
export function inlineFromRich(html) {
  return String(html || '').replace(/<\/p>\s*<p[^>]*>/g, '<br/>').replace(/^\s*<p[^>]*>|<\/p>\s*$/g, '').trim();
}

export function plainText(html, max = 120) {
  const t = htmlToText(html).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

const TAG_LABELS = { h1: 'Main heading', h2: 'Heading', h3: 'Sub-heading', h4: 'Small heading', h5: 'Small heading', h6: 'Small heading', a: 'Link text', button: 'Button text', li: 'List item', label: 'Label', strong: 'Bold text', figcaption: 'Picture caption', summary: 'Question' };
export function fieldLabel(key, f) {
  if (f.kind === 'text') return TAG_LABELS[f.tag] || (f.link ? 'Link text' : 'Text');
  if (f.kind === 'rich') return 'Text block';
  if (f.kind === 'link') return f.of ? 'Link address' : f.text ? 'Link' : 'Link (picture or icon)';
  if (f.kind === 'image') return 'Picture';
  if (f.kind === 'bg') return 'Background picture';
  if (f.kind === 'number') return 'Number';
  if (f.kind === 'gallery') return 'Pictures';
  return 'Item';
}

export function uid(prefix = 's') {
  const a = new Uint8Array(5);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  return prefix + [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const absolute = (websiteUrl, url) => (!url ? '' : /^https?:\/\//i.test(url) ? url : `${websiteUrl}${url.startsWith('/') ? '' : '/'}${url}`);

// a smaller copy of a Cloudinary picture for the editor
export function thumbOf(url, width = 480) {
  const m = String(url || '').match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
  if (!m || /^(f_|q_|c_|w_)/.test(m[2])) return url;
  return `${m[1]}f_auto,q_auto,c_limit,w_${width}/${m[2]}`;
}

export function builtInPicture(websiteUrl, item, w = 400) {
  if (!item) return '';
  if (item.url) return thumbOf(item.url, w);
  if (item.preview) return absolute(websiteUrl, item.preview);
  if (item.src) return absolute(websiteUrl, `/images/${item.src.replace(/\.[a-z0-9]+$/i, '')}-${w}.webp`);
  return '';
}

export function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// the pages a link can point to, for the link boxes
export function pageOptions(schema, custom = []) {
  const list = (schema ? schema.pages : []).map(p => ({ path: p.path, name: p.name }));
  for (const c of custom) if (c.path) list.push({ path: c.path, name: c.title || c.path });
  return list;
}
