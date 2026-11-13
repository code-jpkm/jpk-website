import { dbConfigured } from './db.js';
import { ensureSeedAdmin, ensureCategories, renameSanitaryCategory, importJpkUpdates, retirePlaceholderPosts, fixAuditTexts, importProducts } from './seed.js';
import { websiteUrl } from './siteAddress.js';
import { cloudinaryProblem } from './cloudinarySettings.js';

// Runs when the server starts and again after each sign-in until everything is in place.
// Shared through globalThis because Next.js loads this module separately for instrumentation and routes.
const state = globalThis.__jpkStartup || (globalThis.__jpkStartup = { running: null });

export function runStartupTasks() {
  if (!dbConfigured()) return Promise.resolve();
  if (state.running) return state.running;
  state.running = (async () => {
    const admin = await ensureSeedAdmin();
    if (admin.status === 'created') console.log(`[jpk-admin] First administrator created: ${admin.email}`);
    await websiteUrl().catch(() => {}); // the website address set in the admin (allowed origins of the forms)
    try {
      await importJpkUpdates();
      const r = await retirePlaceholderPosts();
      if (r.status === 'drafted') console.log(`[jpk-admin] ${r.count} placeholder JPK Updates posts moved to the drafts.`);
      const t = await fixAuditTexts();
      if (t.status === 'fixed') console.log(`[jpk-admin] ${t.count} saved website text(s) corrected (website audit).`);
    } catch (err) {
      console.error('[jpk-admin] could not check the JPK Updates posts and saved texts (will retry):', err && err.message);
    }
    try {
      await ensureCategories();
      const r = await renameSanitaryCategory();
      if (r.status === 'renamed') console.log('[jpk-admin] Product category "Sanitary Components" renamed "Sanitary Castings".');
    } catch (err) {
      console.error('[jpk-admin] could not add the product categories:', err && err.message);
    }
    const problem = cloudinaryProblem();
    if (problem) {
      // the products have pictures: wait for working Cloudinary settings (checked again at the next start or sign-in)
      if (!state.warned) console.error(`[jpk-admin] ${problem} The website's products are added once this is fixed.`);
      state.warned = true;
      return;
    }
    try {
      const r = await importProducts();
      if (r.status === 'imported') console.log(`[jpk-admin] Added ${r.count} products from the website's product pages.`);
    } catch (err) {
      console.error('[jpk-admin] could not add the website\'s products (will continue at the next start or sign-in):', err && err.message);
    }
  })().finally(() => {
    state.running = null;
  });
  return state.running;
}
