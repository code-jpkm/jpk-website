// Links inside the HTML of a text (the website's texts and text blocks, sections made in the admin, JPK Updates
// posts): list them, change one, remove one (its words stay), and link chosen words. Works on the cleaned HTML the
// admin saves (sanitize-html output: quoted attributes, no nested links); the result is cleaned again when saved.

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}
export const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = s => escapeHtml(s).replace(/"/g, '&quot;');
export const plainText = html => decodeEntities(String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

const TOKEN = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>/g;
function tokens(html) {
  const out = [];
  let last = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(html))) {
    if (m.index > last) out.push({ type: 'text', raw: html.slice(last, m.index), start: last, end: m.index });
    const raw = m[0];
    const name = raw.startsWith('<!--') ? '' : (raw.match(/^<\/?([a-zA-Z][\w:-]*)/) || [])[1].toLowerCase();
    out.push({ type: 'tag', raw, start: m.index, end: TOKEN.lastIndex, name, closing: raw.startsWith('</') });
    last = TOKEN.lastIndex;
  }
  if (last < html.length) out.push({ type: 'text', raw: html.slice(last), start: last, end: html.length });
  return out;
}

function parseAttrs(openTag) {
  const attrs = {};
  const body = openTag.replace(/^<a\b/i, '').replace(/\/?>$/, '');
  for (const m of body.matchAll(/([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

// [{ i, start, end, inner, text, href, newTab, nofollow, attrs }] in document order (start/end: the whole <a>…</a>)
export function anchors(html) {
  const h = String(html || '');
  const out = [];
  let open = null;
  for (const t of tokens(h)) {
    if (t.type !== 'tag' || t.name !== 'a') continue;
    if (!t.closing) {
      if (!open) open = t;
      continue;
    }
    if (!open) continue;
    const attrs = parseAttrs(open.raw);
    const inner = h.slice(open.end, t.start);
    const rel = String(attrs.rel || '').toLowerCase().split(/\s+/);
    const img = inner.match(/<img\b[^>]*\balt\s*=\s*"([^"]*)"/i);
    out.push({ i: out.length, start: open.start, end: t.end, inner, text: plainText(inner), picture: img ? decodeEntities(img[1]).trim() : '', href: attrs.href || '', newTab: attrs.target === '_blank', nofollow: rel.includes('nofollow'), attrs });
    open = null;
  }
  return out;
}

function openTag(attrs, { href, newTab, nofollow }) {
  const out = { ...attrs, href };
  if (newTab) out.target = '_blank'; else delete out.target;
  const rel = new Set(String(attrs.rel || '').toLowerCase().split(/\s+/).filter(t => ['sponsored', 'ugc'].includes(t)));
  if (nofollow) rel.add('nofollow');
  if (newTab) { rel.add('noopener'); rel.add('noreferrer'); }
  if (rel.size) out.rel = [...rel].join(' '); else delete out.rel;
  return `<a ${Object.entries(out).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}="${escapeAttr(v)}"`).join(' ')}>`;
}

// the link number i with a new address / words / options; null if there is no such link
export function setAnchor(html, i, { href, text, newTab, nofollow }) {
  const h = String(html || '');
  const a = anchors(h)[i];
  if (!a) return null;
  const inner = text !== undefined && String(text).trim() && String(text).trim() !== a.text ? escapeHtml(String(text).trim()) : a.inner;
  return h.slice(0, a.start) + openTag(a.attrs, { href, newTab, nofollow }) + inner + '</a>' + h.slice(a.end);
}

// the link number i taken away, its words kept; null if there is no such link
export function unwrapAnchor(html, i) {
  const h = String(html || '');
  const a = anchors(h)[i];
  return a ? h.slice(0, a.start) + a.inner + h.slice(a.end) : null;
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function wordsPattern(words) {
  const parts = String(words || '').trim().split(/\s+/).filter(Boolean).map(escapeRe);
  if (!parts.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])${parts.join('[\\s\\u00a0]+')}(?![\\p{L}\\p{N}])`, 'giu');
}

// where the words appear in the text outside links: [{ start, end, match, before, after }] (start/end in the HTML;
// a place counts only when the words are not split by formatting)
export function findWords(html, words, { limit = 50 } = {}) {
  const h = String(html || '');
  const re = wordsPattern(words);
  if (!re) return [];
  const out = [];
  let inLink = 0;
  const all = tokens(h);
  const BLOCK = /^(p|li|ul|ol|h[1-6]|div|br|td|th|tr|blockquote|section|figure|figcaption|table)$/;
  // the text next to a place, within the same paragraph (dir -1: before it, 1: after it)
  const near = (ti, dir) => {
    const parts = [];
    for (let j = ti + dir, n = 0; j >= 0 && j < all.length && n < 8; j += dir, n += 1) {
      const t = all[j];
      if (t.type === 'tag') { if (BLOCK.test(t.name)) break; continue; }
      parts.push(decodeEntities(t.raw));
    }
    return (dir < 0 ? parts.reverse() : parts).join('');
  };
  all.forEach((t, ti) => {
    if (t.type === 'tag') {
      if (t.name === 'a') inLink += t.closing ? -1 : 1;
      if (inLink < 0) inLink = 0;
      return;
    }
    if (inLink || out.length >= limit) return;
    // decoded characters of this text with their place in the HTML
    const chars = [];
    const pos = [];
    const raw = t.raw;
    for (let i = 0; i < raw.length;) {
      const m = raw[i] === '&' ? raw.slice(i).match(/^&(#x[0-9a-f]+|#\d+|[a-z]+);/i) : null;
      if (m) {
        const d = decodeEntities(m[0]);
        for (const ch of d) { chars.push(ch); pos.push([t.start + i, t.start + i + m[0].length]); }
        i += m[0].length;
      } else { chars.push(raw[i]); pos.push([t.start + i, t.start + i + 1]); i += 1; }
    }
    const dec = chars.join('');
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(dec)) && out.length < limit) {
      const a = m.index;
      const b = m.index + m[0].length - 1;
      const before = (near(ti, -1) + dec.slice(0, a)).replace(/\s+/g, ' ').slice(-60);
      const after = (dec.slice(b + 1) + near(ti, 1)).replace(/\s+/g, ' ').slice(0, 60);
      out.push({ start: pos[a][0], end: pos[b][1], match: m[0], before, after });
    }
  });
  return out;
}

// the words at start..end (from findWords) made a link; null when that place no longer holds the words
export function linkWords(html, { start, end, match }, { href, newTab, nofollow }) {
  const h = String(html || '');
  if (!(start >= 0 && end > start && end <= h.length)) return null;
  const piece = h.slice(start, end);
  if (/[<>]/.test(piece)) return null;
  if (match !== undefined && decodeEntities(piece).replace(/\s+/g, ' ').toLowerCase() !== String(match).replace(/\s+/g, ' ').toLowerCase()) return null;
  // not inside a link already
  const inside = anchors(h).some(a => start >= a.start && end <= a.end);
  if (inside) return null;
  return h.slice(0, start) + openTag({}, { href, newTab, nofollow }) + piece + '</a>' + h.slice(end);
}
