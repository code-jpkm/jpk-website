import { connectDB } from './db.js';
import { HttpError } from './errors.js';
import { Download, DOWNLOAD_CATEGORIES } from '../models/Download.js';

// Website › Downloads: PDFs (catalogues, certificates, data sheets) the website lists on /downloads/.

export const CATEGORY_LABELS = { catalogue: 'Catalogues', certificate: 'Certificates', brochure: 'Brochures', datasheet: 'Data sheets', other: 'Other documents' };

const line = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

// the fields of a download from a form or JSON body (only those given)
export function downloadFields(body, { partial = false } = {}) {
  const get = k => (body && typeof body.get === 'function' ? body.get(k) : body ? body[k] : undefined);
  const out = {};
  const has = k => get(k) !== undefined && get(k) !== null;
  if (!partial || has('title')) {
    out.title = line(get('title'), 160);
    if (!out.title) throw new HttpError(400, 'Please give the file a title, for example "Ductile iron manhole covers – catalogue".');
  }
  if (!partial || has('category')) out.category = DOWNLOAD_CATEGORIES.includes(String(get('category'))) ? String(get('category')) : 'catalogue';
  if (!partial || has('description')) out.description = line(get('description'), 400);
  if (has('published')) out.published = ['true', '1', 'on', true].includes(get('published'));
  if (has('order')) { const n = Number(get('order')); if (Number.isFinite(n)) out.order = Math.max(-1000, Math.min(1000, Math.round(n))); }
  return out;
}

export function publicDownload(d, origin) {
  return {
    id: String(d._id),
    title: d.title,
    category: d.category,
    categoryLabel: CATEGORY_LABELS[d.category] || 'Documents',
    description: d.description || '',
    url: `${origin}/api/public/downloads/${d._id}`,
    fileName: d.fileName || 'file.pdf',
    size: d.size || 0,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  };
}

// published downloads in their order, for the website
export async function downloadsForWebsite(origin) {
  await connectDB();
  const list = await Download.find({ published: true }).sort({ category: 1, order: 1, createdAt: 1 }).limit(200).lean();
  const rank = c => DOWNLOAD_CATEGORIES.indexOf(c);
  return list.sort((a, b) => rank(a.category) - rank(b.category) || (a.order || 0) - (b.order || 0)).map(d => publicDownload(d, origin));
}
