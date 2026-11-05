import fs from 'node:fs/promises';
import path from 'node:path';
import { connectDB } from './db.js';
import { hashPassword } from './password.js';
import { sanitizeRich } from './sanitize.js';
import { storeImage } from './storage.js';
import { User } from '../models/User.js';
import { Blog } from '../models/Blog.js';
import { ProductCategory } from '../models/ProductCategory.js';
import { getSetting, setSetting } from '../models/Setting.js';

// First-run setup: the first administrator, the product categories of jpkm.in and the six existing
// JPK Updates posts. Every step runs once and never overwrites changes made in the admin.

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
    name: 'Sanitary Components', slug: 'sanitary-components', websitePath: '/products/sanitary-components/',
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
