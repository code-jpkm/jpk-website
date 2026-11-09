import sanitizeHtml from 'sanitize-html';

// Rich text from the editor is cleaned before it is saved, so only safe formatting reaches the website.

// a link's target and rel: a new tab only as target="_blank" (then rel noopener noreferrer); rel keeps nofollow,
// sponsored and ugc (what search engines read), nothing else
export function cleanAnchorAttribs(attribs) {
  const out = { ...attribs };
  if (out.target && out.target !== '_blank') delete out.target;
  const rel = new Set(String(out.rel || '').toLowerCase().split(/\s+/).filter(t => ['nofollow', 'sponsored', 'ugc'].includes(t)));
  if (out.target === '_blank') { rel.add('noopener'); rel.add('noreferrer'); }
  if (rel.size) out.rel = [...rel].join(' '); else delete out.rel;
  return out;
}

const OPTIONS = {
  allowedTags: [
    'p', 'br', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 's', 'sup', 'sub', 'mark', 'code', 'pre',
    'a', 'ul', 'ol', 'li', 'blockquote', 'hr', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    ol: ['start'],
    '*': ['class'],
  },
  allowedClasses: { '*': ['wp-block-*', 'has-*', 'aligncenter', 'alignleft', 'alignright'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    b: 'strong',
    i: 'em',
    strike: 's',
    del: 's',
    h1: 'h2',
    div: 'p',
    a: (tagName, attribs) => ({ tagName, attribs: cleanAnchorAttribs(attribs) }),
  },
  exclusiveFilter: frame => frame.tag === 'img' && !frame.attribs.src,
};

export function sanitizeRich(html) {
  const clean = sanitizeHtml(String(html || ''), OPTIONS).trim();
  // the editor's empty document
  return clean === '<p></p>' ? '' : clean;
}
