import sanitizeHtml from 'sanitize-html';
import { sanitizeRich } from '../sanitize.js';
import { HttpError } from '../errors.js';

// Checks and cleans everything the website editor saves, so only safe, well-formed content reaches the website.
// Content keys come from the website's pages (see the website's src/cms/E.jsx): "<element id>.t0" text,
// ".r0" text block, ".a0" link, ".i0" picture, ".n0" number, "bg.<element id>" section background,
// "<name>.slides" / "<name>.pictures" picture lists.

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function keyKind(key) {
  if (typeof key !== 'string' || key.length > 90) return null;
  if (/^bg\.[0-9a-f]{7}$/.test(key)) return 'image';
  if (!/^[A-Za-z0-9_-]{1,40}\.[A-Za-z0-9_-]{1,40}$/.test(key)) return null;
  if (/\.(slides|pictures)$/.test(key)) return 'gallery';
  const m = key.match(/\.([train])\d{1,4}$/);
  return m ? { t: 'text', r: 'rich', a: 'link', i: 'image', n: 'number' }[m[1]] : null;
}

// a line of text: a few inline tags only (line breaks, bold, italic, links)
const INLINE = {
  allowedTags: ['br', 'strong', 'em', 'b', 'i', 'u', 's', 'sup', 'sub', 'span', 'a', 'small', 'mark'],
  allowedAttributes: { a: ['href', 'target', 'rel'], span: ['class'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    a: (tagName, attribs) => {
      const out = { ...attribs };
      if (out.target && out.target !== '_blank') delete out.target;
      if (out.target === '_blank') out.rel = 'noopener noreferrer';
      return { tagName, attribs: out };
    },
  },
};
export function cleanInline(html) {
  return sanitizeHtml(String(html || ''), INLINE).trim();
}

// the "Custom HTML" section: any markup except scripts and event handlers
const ANY = {
  allowedTags: false,
  allowedAttributes: false,
  allowVulnerableTags: true,
  nonTextTags: ['script', 'noscript', 'textarea', 'option'],
  exclusiveFilter: frame => frame.tag === 'script',
  transformTags: {
    '*': (tagName, attribs) => ({
      tagName,
      attribs: Object.fromEntries(Object.entries(attribs).filter(([k, v]) => !/^on/i.test(k) && !/^\s*(javascript|vbscript|data:text\/html)/i.test(String(v)))),
    }),
  },
};
export function cleanCustomHtml(html) {
  return sanitizeHtml(String(html || '').slice(0, 200000), ANY).trim();
}

// a link address: site pages ("/about-us/"), anchors, web addresses, email and phone links
export function cleanHref(v) {
  let href = str(v, 1000);
  if (!href) return '';
  if (/^(javascript|vbscript|data):/i.test(href)) return '';
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href)) return href;
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(href)) return `mailto:${href}`;
  if (/^\+?[\d\s()-]{6,}$/.test(href)) return `tel:${href.replace(/[^\d+]/g, '')}`;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(href)) return `https://${href}`;
  return '';
}

export function cleanLink(v, { label = false } = {}) {
  if (!isObj(v)) return null;
  const href = cleanHref(v.href);
  if (!href) return null;
  const out = { href };
  if (v.newTab) out.newTab = true;
  if (label && str(v.label, 120)) out.label = str(v.label, 120);
  return out;
}

const PICTURE_URL = /^(https?:\/\/[^\s"'<>]+|\/api\/files\/[a-f0-9]{24})$/i;
export function cleanImage(v) {
  if (!isObj(v)) return null;
  const url = str(v.url, 1000);
  if (!PICTURE_URL.test(url)) return null;
  const out = { url };
  const w = Number(v.width), h = Number(v.height);
  if (w > 0 && w < 20000) out.width = Math.round(w);
  if (h > 0 && h < 20000) out.height = Math.round(h);
  const alt = str(v.alt, 300);
  if (alt) out.alt = alt;
  if (typeof v.publicId === 'string' && v.publicId.length < 300) out.publicId = v.publicId;
  if (['cloudinary', 'db', 'external'].includes(v.provider)) out.provider = v.provider;
  return out;
}

// a picture of the website itself ("2025/12/Sanitary-Casting.jpg"), kept when a picture list is rearranged
function cleanBuiltIn(v) {
  if (!isObj(v) || typeof v.src !== 'string') return null;
  if (!/^[\w./-]{3,200}\.(jpe?g|png|webp|gif|avif|svg)$/i.test(v.src) || v.src.includes('..')) return null;
  const out = { src: v.src };
  for (const k of ['sw', 'w', 'h']) { const n = Number(v[k]); if (n > 0 && n < 20000) out[k] = Math.round(n); }
  out.alt = str(v.alt, 300);
  return out;
}

function cleanNumber(v) {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) < 1e12 ? n : undefined;
}

// { key: value } of a page or of the header/footer; a missing key means "as built"
export function cleanContent(input) {
  const out = {};
  if (!isObj(input)) return out;
  const keys = Object.keys(input);
  if (keys.length > 3000) throw new HttpError(413, 'Too many changes on one page.');
  for (const key of keys) {
    const kind = keyKind(key);
    const v = input[key];
    if (!kind || v === null || v === undefined) continue;
    if (kind === 'text') { if (typeof v === 'string') out[key] = cleanInline(v.slice(0, 20000)); }
    else if (kind === 'rich') { if (typeof v === 'string') out[key] = sanitizeRich(v.slice(0, 300000)); }
    else if (kind === 'link') { const l = cleanLink(v); if (l) out[key] = l; }
    else if (kind === 'image') { const i = cleanImage(v); if (i) out[key] = i; }
    else if (kind === 'number') { const n = cleanNumber(v); if (n !== undefined) out[key] = n; }
    else if (kind === 'gallery' && Array.isArray(v)) {
      const list = v.slice(0, 60).map(x => (x && x.url ? cleanImage(x) : cleanBuiltIn(x))).filter(Boolean);
      if (list.length) out[key] = list;
    }
  }
  return out;
}

// one section made with the section builder: only the fields its type has, each in its own format
function cleanField(f, v) {
  switch (f.type) {
    case 'text': return str(v, 400);
    case 'textarea': return f.code ? cleanCustomHtml(v) : str(v, 6000);
    case 'rich': return typeof v === 'string' ? sanitizeRich(v.slice(0, 300000)) : '';
    case 'image': return cleanImage(v);
    case 'images': return Array.isArray(v) ? v.slice(0, 80).map(cleanImage).filter(Boolean) : [];
    case 'link': return cleanLink(v, { label: true });
    case 'color': return typeof v === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v.trim()) ? v.trim() : undefined;
    case 'select': { const ok = (f.options || []).map(o => String(o[0])); return ok.includes(String(v)) ? String(v) : f.default !== undefined ? String(f.default) : ok[0]; }
    case 'number': return cleanNumber(v);
    case 'toggle': return Boolean(v);
    case 'list': return Array.isArray(v) ? v.slice(0, 80).filter(isObj).map(item => cleanFields(f.fields || [], item)) : [];
    case 'category': return typeof v === 'string' && /^[a-z0-9-]{1,120}$/.test(v) ? v : undefined;
    default: return undefined;
  }
}
function cleanFields(fields, data) {
  const out = {};
  for (const f of fields) {
    const v = cleanField(f, isObj(data) ? data[f.key] : undefined);
    if (v !== undefined && v !== null && v !== '') out[f.key] = v;
  }
  return out;
}
export function cleanBuilderSection(item, types) {
  const def = types[item && item.type];
  if (!def) return null;
  const id = typeof item.id === 'string' && /^[A-Za-z0-9_-]{3,40}$/.test(item.id) ? item.id : null;
  if (!id) return null;
  const out = { id, type: item.type, data: cleanFields(def.fields || [], item.data) };
  if (item.hidden) out.hidden = true;
  return out;
}

// the order of a page's sections: its own ({ ref }) and builder sections ({ id, type, data })
export function cleanSections(list, { refs = [], types }) {
  if (list === null || list === undefined) return null;
  if (!Array.isArray(list)) throw new HttpError(400, 'The list of sections is not valid.');
  if (list.length > 120) throw new HttpError(413, 'A page can have at most 120 sections.');
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (!isObj(item)) continue;
    if (item.ref) {
      if (!refs.includes(item.ref) || seen.has(`ref:${item.ref}`)) continue;
      seen.add(`ref:${item.ref}`);
      out.push(item.hidden ? { ref: item.ref, hidden: true } : { ref: item.ref });
    } else {
      const s = cleanBuilderSection(item, types);
      if (!s || seen.has(`id:${s.id}`)) continue;
      seen.add(`id:${s.id}`);
      out.push(s);
    }
  }
  return out;
}

export function cleanSeo(v) {
  if (!isObj(v)) return {};
  const out = {};
  const title = str(v.title, 140), description = str(v.description, 320), h1 = str(v.h1, 200);
  if (title) out.title = title;
  if (description) out.description = description;
  if (h1) out.h1 = h1;
  const image = cleanImage(v.image);
  if (image) out.image = image;
  if (v.noindex) out.noindex = true;
  return out;
}

// addresses the website uses for other things
const RESERVED = /^\/(jpk-updates|api|images|assets|fonts|wp|cms-preview|404)(\/|$)/;
export function cleanPath(v) {
  const raw = str(v, 200).toLowerCase();
  const parts = raw.split('/').map(p => p.trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')).filter(Boolean);
  if (!parts.length) return '';
  return `/${parts.slice(0, 4).join('/')}/`;
}
export function pathProblem(path, { takenBy = [] } = {}) {
  if (!path) return 'Please give the page an address, for example /quality-policy/.';
  if (RESERVED.test(path)) return `The address ${path} is used by the website for something else. Please choose another.`;
  if (takenBy.includes(path)) return `Another page already has the address ${path}. Please choose another.`;
  return null;
}

export function cleanMenuItems(list, depth = 0) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 60).filter(isObj).map((it, i) => {
    const label = str(it.label, 80);
    if (!label) return null;
    const to = it.to === '#' ? '#' : cleanHref(it.to) || '#';
    const out = { id: (typeof it.id === 'number' && Number.isFinite(it.id)) || (typeof it.id === 'string' && /^[\w-]{1,40}$/.test(it.id)) ? it.id : `m${depth}${i}${Date.now() % 100000}`, label, to };
    if (it.newTab) out.newTab = true;
    if (it.hidden) out.hidden = true;
    if (['post_type', 'custom', 'taxonomy'].includes(it.type)) out.type = it.type;
    if (['page', 'custom', 'post', 'category'].includes(it.object)) out.object = it.object;
    if (it.home) out.home = true;
    if (depth < 3 && Array.isArray(it.children) && it.children.length) {
      const children = cleanMenuItems(it.children, depth + 1);
      if (children.length) out.children = children;
    }
    return out;
  }).filter(Boolean);
}

export function cleanSettings(v, schema) {
  const out = { theme: {}, customCss: '' };
  if (!isObj(v)) return out;
  const theme = isObj(v.theme) ? v.theme : {};
  const colors = (schema && schema.theme && schema.theme.colors) || [];
  const fonts = (schema && schema.theme && schema.theme.fonts) || [];
  const choices = (schema && schema.theme && schema.theme.fontChoices) || [];
  for (const c of colors) {
    const val = typeof theme[c.key] === 'string' ? theme[c.key].trim() : '';
    if (/^#[0-9a-f]{6}$/i.test(val)) out.theme[c.key] = val.toUpperCase();
  }
  for (const f of fonts) {
    const val = typeof theme[f.key] === 'string' ? theme[f.key].trim() : '';
    if (val && choices.includes(val)) out.theme[f.key] = val;
  }
  // CSS only: nothing that could end the style element it is placed in
  out.customCss = str(v.customCss, 100000).replace(/<\/?\s*(style|script)/gi, '');
  return out;
}
