import { ProductCategory } from '../models/ProductCategory.js';

// Helpers for the nested product categories.

export async function loadCategories() {
  return ProductCategory.find({}).sort({ order: 1, name: 1 }).lean();
}

// The category and everything below it.
export function descendantIds(categories, rootId) {
  const root = String(rootId);
  const children = new Map();
  for (const c of categories) {
    const p = c.parent ? String(c.parent) : '';
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(String(c._id));
  }
  const out = [root];
  for (let i = 0; i < out.length; i++) for (const k of children.get(out[i]) || []) out.push(k);
  return out;
}

// "Sanitary Castings › Ductile Iron › Solid Top"
export function categoryLabel(categories, id) {
  const byId = new Map(categories.map(c => [String(c._id), c]));
  const names = [];
  let cur = byId.get(String(id));
  for (let guard = 0; cur && guard < 10; guard++) {
    names.unshift(cur.name);
    cur = cur.parent ? byId.get(String(cur.parent)) : null;
  }
  return names.join(' › ');
}

// Categories in menu order with their depth, for drop-downs and the categories screen.
export function flattenTree(categories) {
  const kids = new Map();
  for (const c of categories) {
    const p = c.parent ? String(c.parent) : '';
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(c);
  }
  const ids = new Set(categories.map(c => String(c._id)));
  const out = [];
  const walk = (parentKey, depth) => {
    for (const c of kids.get(parentKey) || []) {
      out.push({ ...c, depth });
      if (depth < 8) walk(String(c._id), depth + 1);
    }
  };
  walk('', 0);
  // categories whose parent was removed are shown at the top level
  for (const c of categories) if (c.parent && !ids.has(String(c.parent)) && !out.some(o => String(o._id) === String(c._id))) out.push({ ...c, depth: 0 });
  return out;
}
