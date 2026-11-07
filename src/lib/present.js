import { excerptFromHtml } from './validate.js';

// How content is handed to the public website: absolute picture addresses, responsive Cloudinary sizes.

export function publicOrigin(req) {
  const fixed = String(process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');
  if (fixed) return fixed;
  const url = new URL(req.url);
  const proto = String(req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')).split(',')[0].trim();
  const host = String(req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host).split(',')[0].trim();
  return `${proto}://${host}`;
}

export function websiteUrl() {
  return String(process.env.WEBSITE_URL || 'https://jpkm.in').trim().replace(/\/+$/, '');
}

const CLD_RE = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

export function isCloudinaryUrl(url) {
  return CLD_RE.test(String(url || ''));
}

// Add a Cloudinary transformation (resize/format) to a picture address.
export function cldUrl(url, transform) {
  const m = String(url || '').match(CLD_RE);
  return m ? `${m[1]}${transform}/${m[2]}` : url;
}

// Small preview for admin lists.
export function thumbUrl(url, width = 320) {
  return isCloudinaryUrl(url) ? cldUrl(url, `f_auto,q_auto,c_limit,w_${width}`) : url;
}

function absolute(url, origin) {
  return url && url.startsWith('/') ? `${origin}${url}` : url;
}

export function presentImage(img, origin, { max = 1600, widths = [400, 800, 1200, 1600], quality = 'auto' } = {}) {
  if (!img || !img.url) return null;
  const base = { alt: img.alt || '', width: img.width || null, height: img.height || null };
  if (isCloudinaryUrl(img.url)) {
    const limit = img.width ? Math.min(max, img.width) : max;
    const sizes = [...new Set([...widths.filter(w => w < limit), limit])];
    const t = w => `f_auto,q_${quality},c_limit,w_${w}`;
    return { ...base, url: cldUrl(img.url, t(limit)), original: img.url, srcset: sizes.map(w => `${cldUrl(img.url, t(w))} ${w}w`).join(', ') };
  }
  return { ...base, url: absolute(img.url, origin) };
}

// Rich text for the website: absolute addresses for pictures kept in the database, optimised Cloudinary pictures.
export function presentHtml(html, origin) {
  return String(html || '')
    .replace(/(\s(?:src|href)=["'])\/api\/files\//g, `$1${origin}/api/files/`)
    .replace(/(<img\b[^>]*\ssrc=["']https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?!f_auto)/g, '$1f_auto,q_auto,c_limit,w_1600/');
}

const iso = d => (d ? new Date(d).toISOString() : null);

export function publicBlog(b, origin, { withContent = true } = {}) {
  return {
    _id: String(b._id),
    id: String(b._id),
    slug: b.slug,
    title: b.title,
    excerpt: b.excerpt || excerptFromHtml(b.content),
    category: b.category || 'JPK Updates',
    tags: b.tags || [],
    author: b.authorName || 'JPK Metallics',
    publishedAt: iso(b.publishedAt || b.createdAt),
    createdAt: iso(b.createdAt),
    updatedAt: iso(b.updatedAt),
    coverImage: presentImage(b.coverImage, origin),
    ...(withContent ? { content: presentHtml(b.content, origin) } : {}),
    seo: { title: b.seoTitle || '', description: b.seoDescription || '' },
  };
}

export function publicJob(j, origin) {
  return {
    _id: String(j._id),
    id: String(j._id),
    slug: j.slug,
    title: j.title,
    department: j.department || '',
    location: j.location || '',
    employmentType: j.employmentType || '',
    experience: j.experience || '',
    summary: j.summary || '',
    description: presentHtml(j.description, origin),
    responsibilities: j.responsibilities || [],
    requirements: j.requirements || [],
    openings: j.openings || 0,
    publishedAt: iso(j.publishedAt || j.createdAt),
    closingDate: iso(j.closingDate),
    createdAt: iso(j.createdAt),
    updatedAt: iso(j.updatedAt),
  };
}

export function publicCategory(c, origin, extra = {}) {
  return {
    _id: String(c._id),
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    parent: c.parent ? String(c.parent._id || c.parent) : null,
    description: c.description || '',
    image: presentImage(c.image, origin),
    order: c.order || 0,
    websitePath: c.websitePath || '',
    ...extra,
  };
}

export function publicProduct(p, origin) {
  const cat = p.category && typeof p.category === 'object' && p.category.name ? p.category : null;
  return {
    _id: String(p._id),
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    code: p.code || '',
    category: cat ? { id: String(cat._id), name: cat.name, slug: cat.slug, websitePath: cat.websitePath || '' } : null,
    summary: p.summary || excerptFromHtml(p.description),
    description: presentHtml(p.description, origin),
    images: (p.images || []).map(img => presentImage(img, origin, { max: 2000, widths: [400, 800, 1200, 1600, 2000], quality: 'auto:good' })).filter(Boolean),
    specs: (p.specs || []).filter(s => s && s.label),
    specTable: p.specTable && p.specTable.columns && p.specTable.columns.length
      ? { columns: p.specTable.columns, rows: (p.specTable.rows || []).map(r => (Array.isArray(r) ? r : (r && r.cells) || [])) }
      : null,
    loadClass: p.loadClass || '',
    material: p.material || '',
    features: p.features || [],
    options: p.options || [],
    applications: p.applications || [],
    standards: p.standards || [],
    featured: Boolean(p.featured),
    order: p.order || 0,
    seo: { title: p.seoTitle || '', description: p.seoDescription || '' },
    updatedAt: iso(p.updatedAt),
  };
}
