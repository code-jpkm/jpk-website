import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute, plain } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { isObjectId, uniqueSlug } from '@/lib/validate';
import { parseCategory } from '@/lib/inputs';
import { loadCategories, descendantIds } from '@/lib/categories';
import { releaseImages } from '@/lib/storage';
import { Product } from '@/models/Product';
import { ProductCategory } from '@/models/ProductCategory';

export const dynamic = 'force-dynamic';

async function load(params) {
  const { id } = await params;
  if (!isObjectId(id)) throw new HttpError(404, 'This category does not exist.');
  await connectDB();
  const doc = await ProductCategory.findById(id);
  if (!doc) throw new HttpError(404, 'This category does not exist (it may have been deleted).');
  return doc;
}

export const GET = adminRoute(async (req, { params }) => {
  await requireUser('products', 'view');
  return json({ item: plain(await load(params)) });
});

export const PATCH = adminRoute(async (req, { params }) => {
  await requireUser('products', 'update');
  const data = parseCategory(await readJson(req), { partial: true });
  const doc = await load(params);
  if (data.parent) {
    if (!(await ProductCategory.exists({ _id: data.parent }))) throw new HttpError(400, 'The chosen parent category no longer exists.');
    const below = descendantIds(await loadCategories(), doc._id);
    if (below.includes(String(data.parent))) throw new HttpError(400, 'A category cannot be placed inside itself or one of its own sub-categories.');
  }
  const oldImage = doc.image ? doc.image.toObject() : null;
  if ('slug' in data) data.slug = data.slug && data.slug === doc.slug ? doc.slug : await uniqueSlug(ProductCategory, data.slug || data.name || doc.name, doc._id);
  Object.assign(doc, data);
  await doc.save();
  if (oldImage && (!doc.image || doc.image.url !== oldImage.url)) releaseImages([oldImage]);
  return json({ item: plain(doc) });
});

export const DELETE = adminRoute(async (req, { params }) => {
  await requireUser('products', 'delete');
  const doc = await load(params);
  const [children, products] = await Promise.all([ProductCategory.countDocuments({ parent: doc._id }), Product.countDocuments({ category: doc._id })]);
  if (children) throw new HttpError(409, `“${doc.name}” has ${children} sub-categor${children === 1 ? 'y' : 'ies'}. Move or delete them first.`);
  if (products) throw new HttpError(409, `“${doc.name}” still has ${products} product${products === 1 ? '' : 's'}. Move them to another category or delete them first.`);
  const image = doc.image ? doc.image.toObject() : null;
  await doc.deleteOne();
  if (image) releaseImages([image]);
  return json({ ok: true });
});
