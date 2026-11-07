import fs from 'node:fs/promises';
import path from 'node:path';
import { connectDB } from './db.js';
import { hashPassword } from './password.js';
import { sanitizeRich } from './sanitize.js';
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

// The six posts that were on the WordPress site, so they can be edited or removed here.
export async function importJpkUpdates() {
  await connectDB();
  if (await getSetting('seed.jpkUpdates')) return { status: 'done-before' };
  if ((await Blog.countDocuments({ source: { $ne: 'wordpress' } })) > 0) {
    await setSetting('seed.jpkUpdates', { at: new Date().toISOString(), skipped: 'posts already added in the admin' });
    return { status: 'skipped' };
  }
  let posts;
  try {
    posts = JSON.parse(await fs.readFile(path.join(process.cwd(), 'seed-data', 'jpk-updates', 'posts.json'), 'utf8'));
  } catch {
    return { status: 'no-data' };
  }
  let added = 0;
  for (const p of posts) {
    if (await Blog.exists({ slug: p.slug })) continue;
    let coverImage = null;
    if (p.image && p.image.file) {
      const buffer = await fs.readFile(path.join(process.cwd(), 'seed-data', 'jpk-updates', path.basename(p.image.file)));
      const stored = await storeImage(buffer, { folder: 'jpk-updates', filename: p.image.file });
      coverImage = { ...stored, alt: p.image.alt || p.title };
    }
    try {
      await Blog.create({
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt || '',
        content: sanitizeRich(p.html),
        coverImage,
        category: p.category || 'JPK Updates',
        status: 'published',
        publishedAt: new Date(p.date),
        authorName: p.author || 'JPK Metallics',
        source: 'wordpress',
      });
      added += 1;
    } catch (err) {
      if (!(err && err.code === 11000)) throw err;
    }
  }
  await setSetting('seed.jpkUpdates', { at: new Date().toISOString(), count: added });
  return { status: 'imported', count: added };
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
