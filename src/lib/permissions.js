// What each user may do. Administrators can do everything, including managing users.
// Other users get per-module rights chosen by an administrator.

export const MODULES = [
  { key: 'blogs', label: 'JPK Updates', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'products', label: 'Products', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'jobs', label: 'Job openings', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'applications', label: 'Job applications', actions: ['view', 'update', 'delete'] },
  { key: 'enquiries', label: 'Enquiries', actions: ['view', 'update', 'delete'] },
];

export const ACTION_LABELS = { view: 'View', create: 'Create', update: 'Edit', delete: 'Delete' };
const ACTION_VERBS = { view: 'view', create: 'create', update: 'edit', delete: 'delete' };

const MODULE_MAP = Object.fromEntries(MODULES.map(m => [m.key, m]));

export function moduleLabel(key) {
  return key === 'users' ? 'users' : (MODULE_MAP[key] ? MODULE_MAP[key].label : key);
}

export function permissionMessage(module, action) {
  return `You do not have permission to ${ACTION_VERBS[action] || action} ${moduleLabel(module).toLowerCase()}.`;
}

// Clean up a permissions object from a form: known modules and actions only; any other right implies "view".
export function normalizePermissions(input) {
  const out = {};
  for (const m of MODULES) {
    const raw = input && Array.isArray(input[m.key]) ? input[m.key] : [];
    const set = new Set(raw.filter(a => m.actions.includes(a)));
    if (set.size) set.add('view');
    out[m.key] = m.actions.filter(a => set.has(a));
  }
  return out;
}

export function isAdmin(user) {
  return Boolean(user && user.active !== false && user.role === 'admin');
}

export function can(user, module, action = 'view') {
  if (!user || user.active === false) return false;
  if (user.role === 'admin') return true;
  if (module === 'users' || module === 'admin') return false;
  const list = (user.permissions && user.permissions[module]) || [];
  if (action === 'view') return list.length > 0;
  return list.includes(action);
}

// Uploading pictures is allowed for anyone who can add or edit posts, products or jobs.
export function canUpload(user) {
  return ['blogs', 'products', 'jobs'].some(m => can(user, m, 'create') || can(user, m, 'update'));
}
