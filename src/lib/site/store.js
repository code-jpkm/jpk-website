import { randomBytes } from 'node:crypto';
import { connectDB } from '../db.js';
import { HttpError } from '../errors.js';
import { scheduleSiteRebuild } from '../siteHook.js';
import { SitePart, partData } from '../../models/SitePart.js';
import { SiteRevision } from '../../models/SiteRevision.js';
import { getSchema, schemaPage, sectionTypes } from './schema.js';
import { createHash } from 'node:crypto';
import { productGroupsForWebsite } from '../products/website.js';
import { cleanContent, cleanSections, cleanSeo, cleanMenuItems, cleanSettings, cleanPath, pathProblem, cleanBuilderSection, cleanSiteSeo } from './clean.js';

// Saving and reading the website editor's changes, and putting them together for the website.
const KEEP_REVISIONS = 30;

export function partKind(key) {
  if (key === 'global' || key === 'menus' || key === 'settings' || key === 'seo') return key;
  if (/^page:[A-Za-z0-9]{1,60}$/.test(key)) return 'page';
  if (/^custom:[a-z0-9]{6,30}$/.test(key)) return 'custom';
  return null;
}

// a saved part with its data ({ key, kind, data, updatedAt, updatedByName }) or null
export async function getPart(key) {
  await connectDB();
  const doc = await SitePart.findOne({ key }).lean();
  return doc ? { ...doc, data: partData(doc) } : null;
}

// the cleaned data of one part, as the editor sent it
async function cleanPart(key, data) {
  const kind = partKind(key);
  if (!kind) throw new HttpError(404, 'This part of the website does not exist.');
  const { schema } = await getSchema();
  const types = sectionTypes(schema);
  const d = data && typeof data === 'object' ? data : {};
  if (kind === 'page') {
    const page = schemaPage(schema, key.slice(5));
    if (!page) throw new HttpError(404, 'This page is not part of the website (any more).');
    const out = { content: cleanContent(d.content), seo: cleanSeo(d.seo) };
    const sections = cleanSections(d.sections, { refs: page.sections.map(s => s.id), types });
    if (sections) out.sections = sections;
    if (d.hidden) out.hidden = true;
    return out;
  }
  if (kind === 'global') return { content: cleanContent(d.content) };
  if (kind === 'menus') return { main: cleanMenuItems(d.main) };
  if (kind === 'settings') return cleanSettings(d, schema);
  if (kind === 'seo') return cleanSiteSeo(d, { pagePaths: [...schema.pages.map(p => p.path), ...(await customPaths(key))] });
  // a page made in the admin
  const title = typeof d.title === 'string' ? d.title.trim().slice(0, 120) : '';
  if (!title) throw new HttpError(400, 'Please give the page a name.');
  const path = cleanPath(d.path);
  const taken = [...schema.pages.map(p => p.path), ...(await customPaths(key))];
  const problem = pathProblem(path, { takenBy: taken });
  if (problem) throw new HttpError(400, problem);
  return {
    id: key.slice(7), title, path, published: Boolean(d.published),
    sections: cleanSections(Array.isArray(d.sections) ? d.sections : [], { refs: [], types }) || [],
    seo: cleanSeo(d.seo),
  };
}

export async function customPaths(exceptKey) {
  await connectDB();
  const list = await SitePart.find({ kind: 'custom', key: { $ne: exceptKey } }).select('path').lean();
  return list.map(p => p.path).filter(Boolean);
}

// pages made in the admin, for lists: { id, title, path, published, updatedAt, updatedByName, sections }
export async function customPages() {
  await connectDB();
  const list = await SitePart.find({ kind: 'custom' }).lean();
  return list.map(p => { const d = partData(p); return { id: p.key.slice(7), title: d.title || p.title, path: d.path || p.path, published: Boolean(d.published), sections: (d.sections || []).length, updatedAt: p.updatedAt, updatedByName: p.updatedByName }; })
    .sort((a, b) => String(a.title).localeCompare(String(b.title)));
}

export async function savePart(key, data, user, { reason = 'website editor' } = {}) {
  const kind = partKind(key);
  const clean = await cleanPart(key, data);
  await connectDB();
  const before = await SitePart.findOne({ key }).lean();
  if (before) {
    await SiteRevision.create({ key, json: before.json, savedBy: before.updatedBy, savedByName: before.updatedByName, savedAt: before.updatedAt || new Date() });
    const old = await SiteRevision.find({ key }).sort({ savedAt: -1 }).skip(KEEP_REVISIONS).select('_id').lean();
    if (old.length) await SiteRevision.deleteMany({ _id: { $in: old.map(o => o._id) } });
  }
  const set = { kind, json: JSON.stringify(clean), updatedBy: user ? user.id : undefined, updatedByName: user ? user.name : '' };
  if (kind === 'custom') Object.assign(set, { title: clean.title, path: clean.path, published: clean.published });
  const doc = await SitePart.findOneAndUpdate({ key }, { $set: set }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  scheduleSiteRebuild(reason);
  return { ...doc, data: clean };
}

export async function deletePart(key, user) {
  await connectDB();
  const before = await SitePart.findOne({ key }).lean();
  if (!before) return false;
  await SiteRevision.create({ key, json: before.json, savedBy: user ? user.id : undefined, savedByName: user ? `${user.name} (deleted)` : 'deleted', savedAt: new Date() });
  await SitePart.deleteOne({ key });
  scheduleSiteRebuild('website editor');
  return true;
}

export async function createCustomPage({ title, path, template }, user) {
  const id = randomBytes(6).toString('hex');
  const key = `custom:${id}`;
  const { schema } = await getSchema();
  const types = sectionTypes(schema);
  // a new page starts with a banner and a text section, filled with the section types' examples
  const start = template === 'empty' ? [] : ['banner', 'text', 'cta'].filter(t => types[t]).map(t => ({ id: newSectionId(), type: t, data: { ...(types[t].defaults || {}), ...(t === 'banner' ? { heading: title } : {}) } }));
  const doc = await savePart(key, { title, path, published: false, sections: start, seo: {} }, user, { reason: 'new page' });
  return { id, key, doc };
}

export function newSectionId() {
  return `s${randomBytes(5).toString('hex')}`;
}

export async function revisions(key) {
  await connectDB();
  return SiteRevision.find({ key }).sort({ savedAt: -1 }).limit(KEEP_REVISIONS).select('savedAt savedByName').lean();
}

export async function restoreRevision(key, id, user) {
  await connectDB();
  const rev = await SiteRevision.findOne({ _id: id, key }).lean();
  if (!rev) throw new HttpError(404, 'This earlier version no longer exists.');
  let data = {};
  try { data = JSON.parse(rev.json || '{}'); } catch { /* an unreadable version restores as empty */ }
  return savePart(key, data, user, { reason: 'earlier version restored' });
}

// ---- for the website ----

const absolutize = (value, origin) => {
  if (typeof value === 'string') return value.replace(/(^|["'(\s])\/api\/files\//g, `$1${origin}/api/files/`);
  if (Array.isArray(value)) return value.map(v => absolutize(v, origin));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, absolutize(v, origin)]));
  return value;
};

// Everything the website needs, in the shape of its src/cms/store.js. Pages made in the admin that are not
// published are left out (the editor shows them from its unsaved copy).
export async function siteForWebsite(origin) {
  await connectDB();
  const parts = await SitePart.find({}).lean();
  const site = { version: null, pages: {}, global: { content: {} }, custom: [], settings: {}, menus: {} };
  let latest = 0;
  for (const p of parts) {
    const t = new Date(p.updatedAt || 0).getTime();
    if (t > latest) latest = t;
    const d = partData(p) || {};
    if (p.kind === 'page') site.pages[p.key.slice(5)] = d;
    else if (p.kind === 'global') site.global = { content: d.content || {} };
    else if (p.kind === 'custom') { if (d.published && d.path) site.custom.push(d); }
    else if (p.kind === 'menus') { if (Array.isArray(d.main) && d.main.length) site.menus = { main: d.main }; }
    else if (p.kind === 'settings') site.settings = d;
    else if (p.kind === 'seo') site.seo = d;
  }
  // a deleted page or a page switched back to "draft" also changes the site: count deletions too
  const lastDeleted = await SiteRevision.findOne({ savedByName: / \(deleted\)$|^deleted$/ }).sort({ savedAt: -1 }).select('savedAt').lean();
  if (lastDeleted) latest = Math.max(latest, new Date(lastDeleted.savedAt).getTime());
  site.version = latest ? new Date(latest).toISOString() : 'none';
  // the product cards of the product pages that differ from the built ones (Products)
  const { schema } = await getSchema({ quick: true });
  const groups = await productGroupsForWebsite(schema.productGroups);
  if (groups) {
    site.productGroups = groups;
    site.version += `~${createHash('sha1').update(JSON.stringify(groups)).digest('base64url').slice(0, 10)}`;
  }
  return absolutize(site, origin);
}

// one builder section, cleaned (used when the editor adds a section from the library)
export async function cleanOneSection(item) {
  const { schema } = await getSchema();
  return cleanBuilderSection(item, sectionTypes(schema));
}
