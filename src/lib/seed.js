import fs from 'node:fs/promises';
import path from 'node:path';
import { connectDB } from './db.js';
import { hashPassword } from './password.js';
import { storeImage } from './storage.js';
import { User } from '../models/User.js';
import { Blog } from '../models/Blog.js';
import { ProductCategory } from '../models/ProductCategory.js';
import { Product } from '../models/Product.js';
import { SitePart, partData } from '../models/SitePart.js';
import { getSetting, setSetting } from '../models/Setting.js';
import { parseProduct } from './inputs.js';
import { uniqueSlug } from './validate.js';
import { cardFingerprint, cardFieldsFromHtml, textOf } from './products/website.js';

// First-run setup: the first administrator, the product categories of jpkm.in, the six existing JPK Updates posts
// and the 88 products of the website's product pages. Every step runs once and never overwrites changes made in
// the admin.

export function seedAdminEmail() {
  return String(process.env.SEED_ADMIN_EMAIL || 'sales@jpkm.in').trim().toLowerCase();
}

function seedAdminPassword() {
  return String(process.env.SEED_ADMIN_PASSWORD || 'admin@123');
}

// Creates the first administrator when there are no users yet.
// resetPassword: also restore the seed password on an existing seed account (recovery from the command line).
export async function ensureSeedAdmin({ resetPassword = false, onlyWhenEmpty = true } = {}) {
  await connectDB();
  await User.init();
  const email = seedAdminEmail();
  const existing = await User.findOne({ email });
  if (existing) {
    if (!resetPassword) return { status: 'exists', email };
    existing.passwordHash = await hashPassword(seedAdminPassword());
    existing.role = 'admin';
    existing.active = true;
    existing.tokenVersion = (existing.tokenVersion || 0) + 1;
    existing.passwordChangedAt = undefined;
    await existing.save();
    return { status: 'reset', email };
  }
  if (onlyWhenEmpty && (await User.countDocuments({})) > 0) return { status: 'skipped', email };
  try {
    await User.create({
      name: 'JPK Admin',
      email,
      passwordHash: await hashPassword(seedAdminPassword()),
      role: 'admin',
      active: true,
      isSeed: true,
    });
  } catch (err) {
    if (err && err.code === 11000) return { status: 'exists', email };
    throw err;
  }
  return { status: 'created', email };
}

const CATEGORY_TREE = [
  {
    name: 'Sanitary Castings', slug: 'sanitary-castings', websitePath: '/products/sanitary-castings/',
    description: 'Ductile iron and grey cast iron manhole covers, recessed covers, double triangular covers, gratings, tree grates and drainage castings.',
    children: [
      {
        name: 'Ductile Iron', slug: 'ductile-iron', websitePath: '/products/ductile-iron/',
        description: 'Solid top and recessed manhole covers, double triangular and multi-leaf covers, gratings and tree grates in ductile iron.',
        children: [
          { name: 'Solid Top', slug: 'ductile-iron-solid-top', websitePath: '/products/ductile-iron/solid-top/', description: 'Single seal, double seal, Arcline and Arcedge solid top ductile iron manhole covers.' },
          { name: 'Recessed Covers', slug: 'ductile-iron-recessed-covers', websitePath: '/products/ductile-iron/recessed-covers/', description: 'Blendfit and Blendfit+ recessed covers that can be filled with concrete, bricks or tiles.' },
          { name: 'Double Triangular', slug: 'ductile-iron-double-triangular', websitePath: '/products/ductile-iron/double-triangular/', description: 'Delta, Delta-R and Multimax double triangular and multi-leaf covers.' },
          { name: 'Gratings', slug: 'ductile-iron-gratings', websitePath: '/products/ductile-iron/gratings/', description: 'Flowline, Flowmaster and Flowdrain gratings and channel grates.' },
          { name: 'Tree Grate', slug: 'ductile-iron-tree-grate', websitePath: '/products/ductile-iron/tree-grate/', description: 'Square and round ductile iron tree grates for landscaping and streetscapes.' },
        ],
      },
      {
        name: 'Cast Iron', slug: 'cast-iron', websitePath: '/products/cast-iron/',
        description: 'Solid top and recessed manhole covers, gratings, floor drains, cleanouts, valve boxes and hydrant boxes in grey cast iron.',
        children: [
          { name: 'Solid Top', slug: 'cast-iron-solid-top', websitePath: '/products/cast-iron/solid-top/', description: 'Single seal, double seal and reversible grey cast iron solid top covers.' },
          { name: 'Recessed', slug: 'cast-iron-recessed', websitePath: '/products/cast-iron/recessed/', description: 'Single and double seal recessed grey cast iron covers.' },
          { name: 'Grating', slug: 'cast-iron-grating', websitePath: '/products/cast-iron/grating/', description: 'Grey cast iron gratings with frames and floor drains.' },
          { name: 'Other CI Casting', slug: 'cast-iron-other-ci-casting', websitePath: '/products/cast-iron/other-ci-casting/', description: 'Cleanout bodies and lids, valve box risers, extension rings and hydrant boxes.' },
        ],
      },
    ],
  },
  { name: 'Engineering Casting', slug: 'engineering-casting', websitePath: '/products/engineering-casting/', description: 'Precision engineering castings in SG iron and grey cast iron, made to drawing.' },
  { name: 'Pipe Fitting', slug: 'pipe-fitting', websitePath: '/products/pipe-fitting/', description: 'S.G. iron (ductile iron) pipe fittings for water supply and drainage.' },
  { name: 'Agricultural Components', slug: 'agricultural-components', websitePath: '/products/agricultural-components/', description: 'Cambridge wheels, star rings, jagged rings and smooth rings for soil preparation.' },
];

export async function ensureCategories() {
  await connectDB();
  if (await getSetting('seed.categories')) return { status: 'done-before' };
  if ((await ProductCategory.countDocuments({})) === 0) {
    const add = async (nodes, parent) => {
      let order = 0;
      for (const n of nodes) {
        order += 10;
        let doc = await ProductCategory.findOne({ slug: n.slug });
        if (!doc) doc = await ProductCategory.create({ name: n.name, slug: n.slug, parent, order, websitePath: n.websitePath, description: n.description });
        if (n.children) await add(n.children, doc._id);
      }
    };
    await add(CATEGORY_TREE, null);
  }
  await setSetting('seed.categories', { at: new Date().toISOString() });
  return { status: 'created' };
}

// Once: the category added as "Sanitary Components" (4 Nov 2026) follows the website's name and address again,
// "Sanitary Castings" at /products/sanitary-castings/ (owner, 6 Nov 2026). Left alone if it was renamed here.
export async function renameSanitaryCategory() {
  await connectDB();
  if (await getSetting('migrate.sanitaryCastings')) return { status: 'done-before' };
  const doc = await ProductCategory.findOne({ slug: 'sanitary-components' });
  let status = 'nothing-to-do';
  if (doc && doc.name === 'Sanitary Components') {
    const set = { name: 'Sanitary Castings' };
    if (!doc.websitePath || doc.websitePath === '/products/sanitary-components/') set.websitePath = '/products/sanitary-castings/';
    if (!(await ProductCategory.exists({ slug: 'sanitary-castings' }))) set.slug = 'sanitary-castings';
    await ProductCategory.updateOne({ _id: doc._id }, { $set: set });
    status = 'renamed';
  }
  await setSetting('migrate.sanitaryCastings', { at: new Date().toISOString(), status });
  return { status };
}

// The six posts that were on the WordPress site were placeholder text (lorem ipsum and "influencer marketing"
// copy, website audit of Nov 2026), so they are no longer added to a new admin. The setting still records that
// the list of posts here is the complete one: the website shows only posts written here.
export async function importJpkUpdates() {
  await connectDB();
  if (await getSetting('seed.jpkUpdates')) return { status: 'done-before' };
  await setSetting('seed.jpkUpdates', { at: new Date().toISOString(), skipped: 'the WordPress posts were placeholder text' });
  return { status: 'skipped' };
}

// the placeholder sentence all six WordPress posts start with
const PLACEHOLDER = /when your team needs to collaborate with the right creator/i;

// Once: the six placeholder posts added on 4 Nov 2026 go to the drafts, so they leave the website and its
// sitemap. They stay in JPK Updates to be rewritten or deleted. A post whose text was rewritten here is left alone.
export async function retirePlaceholderPosts() {
  await connectDB();
  if (await getSetting('migrate.placeholderPosts')) return { status: 'done-before' };
  let seed = [];
  try {
    seed = JSON.parse(await fs.readFile(path.join(process.cwd(), 'seed-data', 'jpk-updates', 'posts.json'), 'utf8'));
  } catch { /* no list: only the placeholder sentence decides */ }
  const slugs = new Set(seed.map(p => p.slug));
  const posts = await Blog.find({ source: 'wordpress', status: 'published' }).select('slug content').lean();
  const ids = posts.filter(b => (slugs.size === 0 || slugs.has(b.slug)) && PLACEHOLDER.test(textOf(b.content || ''))).map(b => b._id);
  if (ids.length) await Blog.updateMany({ _id: { $in: ids } }, { $set: { status: 'draft' } });
  await setSetting('migrate.placeholderPosts', { at: new Date().toISOString(), drafted: ids.length });
  return { status: ids.length ? 'drafted' : 'nothing-to-do', count: ids.length };
}

// Once (website audit, Nov 2026): the texts corrected on the website (wrong comma in the hero, "alegacy", the broken
// About paragraph, "Million Tons", the repeated farming text, the footer copyright and office address) are also
// corrected in texts saved in the website editor before, where they still hold the old wording. Other changes made
// in the editor are left alone.
const AUDIT_TEXT_FIXES = [
  ["page:Home", "4f22c43.r0", "JPK Metallics is a family-run foundry with over five decades of expertise in the iron and steel casting industry. founded on reliability, precision and innovation.Our products serve critical infrastructure. With a legacy spanning 50 years. in the global iron and steel casting industry.", "JPK Metallics is a family-run foundry with five decades of expertise in the iron and steel casting industry. Founded on reliability, precision and innovation, our products serve critical infrastructure around the world."],
  ["page:Home", "0193b03.r0", "is a family-run foundry with nearly five decades of expertise in the iron casting industry.", "is a family-run foundry with five decades of expertise in the iron casting industry."],
  ["page:Home", "0193b03.r0", "With alegacy spanning 50 years, JPK Metallics", "With a legacy spanning 50 years, JPK Metallics"],
  ["page:AboutUs", "f9d36fa.r0", "precision metal casting. Over five decades, his leadership", "precision metal casting. Across five decades, his leadership"],
  ["page:Home", "hero.t0", "Delivering, Innovation, and Reliability Since 1976", "Delivering Innovation and Reliability Since 1976"],
  ["page:Home", "e397eda.t3", "Our castings play a role that supports efficient soil tilling, modern farming practices soil tilling and modern farming practices.", "Our castings support efficient soil tilling and modern farming practices."],
  ["page:SegmentsWeServe", "453cba7.t2", "Our castings play a role that supports efficient soil tilling, modern farming practices soil tilling and modern farming practices.", "Our castings support efficient soil tilling and modern farming practices."],
  ["page:Home", "7354f9a.t0", "Million Tons Exported Annually", "Kgs Exported Annually"],
  ["global", "345d903.r0", "Copyright – © 2025 JPK Metallic. All Right Reserved", "Copyright © 2026 JPK Metallics Pvt. Ltd. All Rights Reserved."],
  ["global", "ba3b38d.t0", "P-15, Bentinck Street Bentinck House, 3rd Floor, Kolkata-700 001, West Bengal, India", "Bentinck House, 3rd Floor, P-15, Bentinck Street, Kolkata – 700001, West Bengal, India"],
  ["global", "44a1c9d.t0", "P-15, Bentinck Street Bentinck House, 3rd Floor, Kolkata-700 001, West Bengal, India", "Bentinck House, 3rd Floor, P-15, Bentinck Street, Kolkata – 700001, West Bengal, India"],
  ["global", "5dc817e.t0", "Address", "Office Address"],
];

export async function fixAuditTexts() {
  await connectDB();
  if (await getSetting('migrate.auditTexts')) return { status: 'done-before' };
  const keys = [...new Set(AUDIT_TEXT_FIXES.map(f => f[0]))];
  const parts = await SitePart.find({ key: { $in: keys } });
  let changed = 0;
  for (const part of parts) {
    const data = partData(part) || {};
    const content = data.content && typeof data.content === 'object' ? data.content : null;
    if (!content) continue;
    let touched = false;
    for (const [key, field, from, to] of AUDIT_TEXT_FIXES) {
      if (key !== part.key || typeof content[field] !== 'string') continue;
      // short texts must match whole ("Address"), longer ones may be part of a saved text block
      const value = content[field];
      if (from.length < 30 ? value.trim() !== from : !value.includes(from)) continue;
      content[field] = from.length < 30 ? to : value.split(from).join(to);
      touched = true;
      changed += 1;
    }
    if (touched) {
      part.json = JSON.stringify(data);
      await part.save();
    }
  }
  await setSetting('migrate.auditTexts', { at: new Date().toISOString(), changed });
  return { status: changed ? 'fixed' : 'nothing-to-do', count: changed };
}

// Once: the products shown on the website's product pages (seed-data/products, made from the pages by
// tools/products in the website project), with their photos, so they can be changed in Products. Each keeps the
// card it came from; while a product is unchanged its card on the website stays exactly as built. Changes made to
// these cards in the website editor before this (name, photo, text) are taken over. Products added in the admin
// before are kept. Safe to run again: cards already imported are skipped, so an interrupted import continues.
export async function importProducts() {
  await connectDB();
  if (await getSetting('seed.products')) return { status: 'done-before' };
  let list;
  try {
    list = JSON.parse(await fs.readFile(path.join(process.cwd(), 'seed-data', 'products', 'products.json'), 'utf8'));
  } catch {
    return { status: 'no-data' };
  }
  const norm = p => (p ? `/${String(p).replace(/^\/+|\/+$/g, '')}/` : '');
  const cats = await ProductCategory.find({}).select('websitePath').lean();
  const catByPath = new Map(cats.filter(c => c.websitePath).map(c => [norm(c.websitePath), c]));
  const content = {};
  for (const part of await SitePart.find({ kind: 'page' }).lean()) content[part.key.slice(5)] = (partData(part) || {}).content || {};
  let added = 0;
  for (const item of list) {
    if (await Product.exists({ 'builtIn.card': item.card })) continue;
    const over = content[item.page] || {};
    const keys = item.keys || {};
    const fields = { name: item.name, loadClass: item.loadClass, material: item.material, summary: item.summary, features: item.features, options: item.options, specs: item.specs };
    if (keys.name && typeof over[keys.name] === 'string' && textOf(over[keys.name])) fields.name = textOf(over[keys.name]);
    if (keys.load && typeof over[keys.load] === 'string') fields.loadClass = textOf(over[keys.load]);
    if (keys.text && typeof over[keys.text] === 'string') Object.assign(fields, cardFieldsFromHtml(over[keys.text]));
    let image;
    const saved = keys.image && over[keys.image];
    if (saved && typeof saved === 'object' && saved.url) {
      image = { url: saved.url, publicId: saved.publicId, provider: saved.provider || 'external', alt: saved.alt || item.image.alt, width: saved.width, height: saved.height };
    } else {
      const buffer = await fs.readFile(path.join(process.cwd(), 'seed-data', 'products', path.basename(item.image.file)));
      const stored = await storeImage(buffer, { folder: 'products', filename: item.image.file });
      image = { ...stored, alt: item.image.alt, width: stored.width || item.image.width, height: stored.height || item.image.height };
    }
    const cat = catByPath.get(norm(item.path));
    const data = parseProduct({ ...fields, category: cat ? String(cat._id) : null, group: item.group, order: item.order, status: 'published', images: [image] });
    data.slug = await uniqueSlug(Product, item.slug);
    const doc = await Product.create(data);
    const saved2 = doc.toObject();
    await Product.updateOne({ _id: doc._id }, { $set: { builtIn: { card: item.card, fp: cardFingerprint(saved2), img: (saved2.images[0] || {}).url || '' } } });
    added += 1;
  }
  await setSetting('seed.products', { at: new Date().toISOString(), count: added });
  return { status: 'imported', count: added };
}
