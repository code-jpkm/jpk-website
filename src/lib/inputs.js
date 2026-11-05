import { HttpError } from './errors.js';
import { sanitizeRich } from './sanitize.js';
import { text, line, list, int, bool, oneOf, dateOrNull, objectIdOrNull, image, images, slugify, email } from './validate.js';
import { normalizePermissions } from './permissions.js';
import { passwordProblem } from './password.js';

// Form input for each kind of item, checked and cleaned. With partial: true only the fields that were
// sent are returned (so a quick "publish" or "status" change does not touch anything else).

function picker(body, partial) {
  return key => !partial || Object.prototype.hasOwnProperty.call(body, key);
}

function slugInput(value) {
  const s = slugify(value);
  if (value && String(value).trim() && !s) throw new HttpError(400, 'The web address (slug) can only use letters, numbers and dashes.');
  return s;
}

export function parseBlog(body, { partial = false } = {}) {
  const has = picker(body, partial);
  const out = {};
  if (has('title')) out.title = line(body.title, { max: 200, required: true, label: 'Title' });
  if (has('slug')) out.slug = slugInput(body.slug);
  if (has('excerpt')) out.excerpt = text(body.excerpt, { max: 600, label: 'Short summary' });
  if (has('content')) out.content = sanitizeRich(body.content);
  if (has('coverImage')) out.coverImage = image(body.coverImage, { label: 'Cover picture' });
  if (has('category')) out.category = line(body.category, { max: 80, label: 'Category' }) || 'JPK Updates';
  if (has('tags')) out.tags = list(body.tags, { maxItems: 20, max: 40, label: 'Tags' });
  if (has('status')) out.status = oneOf(body.status, ['draft', 'published'], 'draft');
  if (has('publishedAt')) out.publishedAt = dateOrNull(body.publishedAt, 'Publish date');
  if (has('authorName')) out.authorName = line(body.authorName, { max: 120, label: 'Author' }) || 'JPK Metallics';
  if (has('seoTitle')) out.seoTitle = line(body.seoTitle, { max: 120, label: 'Search title' });
  if (has('seoDescription')) out.seoDescription = line(body.seoDescription, { max: 300, label: 'Search description' });
  return out;
}

function specs(value) {
  const arr = Array.isArray(value) ? value : [];
  if (arr.length > 60) throw new HttpError(400, 'A product can have at most 60 specification rows.');
  return arr
    .map(s => ({ label: line(s && s.label, { max: 120, label: 'Specification name' }), value: line(s && s.value, { max: 500, label: 'Specification value' }) }))
    .filter(s => s.label || s.value);
}

function specTable(value) {
  const columns = list(value && value.columns, { maxItems: 12, max: 80, label: 'Table columns' });
  if (!columns.length) return { columns: [], rows: [] };
  const rawRows = Array.isArray(value && value.rows) ? value.rows : [];
  if (rawRows.length > 200) throw new HttpError(400, 'The size table can have at most 200 rows.');
  const rows = rawRows
    .map(r => (Array.isArray(r) ? r : r && Array.isArray(r.cells) ? r.cells : []))
    .map(r => columns.map((_, i) => line(r[i], { max: 200, label: 'Table cell' })))
    .filter(r => r.some(Boolean));
  return { columns, rows: rows.map(cells => ({ cells })) };
}

export function parseProduct(body, { partial = false } = {}) {
  const has = picker(body, partial);
  const out = {};
  if (has('name')) out.name = line(body.name, { max: 160, required: true, label: 'Product name' });
  if (has('slug')) out.slug = slugInput(body.slug);
  if (has('code')) out.code = line(body.code, { max: 60, label: 'Product code' });
  if (has('category')) out.category = objectIdOrNull(body.category, 'Category');
  if (has('summary')) out.summary = text(body.summary, { max: 600, label: 'Short description' });
  if (has('description')) out.description = sanitizeRich(body.description);
  if (has('images')) out.images = images(body.images);
  if (has('specs')) out.specs = specs(body.specs);
  if (has('specTable')) out.specTable = specTable(body.specTable);
  if (has('features')) out.features = list(body.features, { maxItems: 40, max: 300, label: 'Features' });
  if (has('applications')) out.applications = list(body.applications, { maxItems: 40, max: 300, label: 'Applications' });
  if (has('standards')) out.standards = list(body.standards, { maxItems: 30, max: 120, label: 'Standards' });
  if (has('featured')) out.featured = bool(body.featured);
  if (has('order')) out.order = int(body.order, { min: -100000, max: 100000, label: 'Display order' });
  if (has('status')) out.status = oneOf(body.status, ['draft', 'published'], 'draft');
  if (has('seoTitle')) out.seoTitle = line(body.seoTitle, { max: 120, label: 'Search title' });
  if (has('seoDescription')) out.seoDescription = line(body.seoDescription, { max: 300, label: 'Search description' });
  return out;
}

export function parseCategory(body, { partial = false } = {}) {
  const has = picker(body, partial);
  const out = {};
  if (has('name')) out.name = line(body.name, { max: 120, required: true, label: 'Category name' });
  if (has('slug')) out.slug = slugInput(body.slug);
  if (has('parent')) out.parent = objectIdOrNull(body.parent, 'Parent category');
  if (has('description')) out.description = text(body.description, { max: 2000, label: 'Description' });
  if (has('image')) out.image = image(body.image, { label: 'Category picture' });
  if (has('order')) out.order = int(body.order, { min: -100000, max: 100000, label: 'Display order' });
  if (has('websitePath')) {
    const p = line(body.websitePath, { max: 200, label: 'Website page' });
    if (p && !/^\/[a-z0-9\-/]*$/i.test(p)) throw new HttpError(400, 'The website page must be a path such as /products/pipe-fitting/.');
    out.websitePath = p;
  }
  return out;
}

export function parseJob(body, { partial = false } = {}) {
  const has = picker(body, partial);
  const out = {};
  if (has('title')) out.title = line(body.title, { max: 160, required: true, label: 'Job title' });
  if (has('slug')) out.slug = slugInput(body.slug);
  if (has('department')) out.department = line(body.department, { max: 100, label: 'Department' });
  if (has('location')) out.location = line(body.location, { max: 120, label: 'Location' });
  if (has('employmentType')) out.employmentType = line(body.employmentType, { max: 60, label: 'Employment type' });
  if (has('experience')) out.experience = line(body.experience, { max: 60, label: 'Experience' });
  if (has('summary')) out.summary = text(body.summary, { max: 600, label: 'Short summary' });
  if (has('description')) out.description = sanitizeRich(body.description);
  if (has('responsibilities')) out.responsibilities = list(body.responsibilities, { maxItems: 40, max: 400, label: 'Responsibilities' });
  if (has('requirements')) out.requirements = list(body.requirements, { maxItems: 40, max: 400, label: 'Requirements' });
  if (has('openings')) out.openings = int(body.openings, { min: 0, max: 999, fallback: 1, label: 'Openings' });
  if (has('status')) out.status = oneOf(body.status, ['draft', 'published', 'closed'], 'draft');
  if (has('publishedAt')) out.publishedAt = dateOrNull(body.publishedAt, 'Publish date');
  if (has('closingDate')) out.closingDate = dateOrNull(body.closingDate, 'Closing date');
  return out;
}

export function parseUser(body, { partial = false } = {}) {
  const has = picker(body, partial);
  const out = {};
  if (has('name')) out.name = line(body.name, { max: 120, required: true, label: 'Name' });
  if (has('email')) out.email = email(body.email, { required: true });
  if (has('role')) out.role = oneOf(body.role, ['admin', 'staff'], 'staff');
  if (has('permissions')) out.permissions = normalizePermissions(body.permissions);
  if (has('active')) out.active = body.active === undefined || body.active === null ? true : bool(body.active);
  // the password is only changed when one is typed
  if (body.password !== undefined && body.password !== '') {
    const problem = passwordProblem(body.password);
    if (problem) throw new HttpError(400, problem);
    out.password = String(body.password);
  } else if (!partial) {
    throw new HttpError(400, 'Please set a password for the new user (at least 8 characters).');
  }
  return out;
}
