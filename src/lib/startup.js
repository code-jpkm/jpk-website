import { dbConfigured } from './db.js';
import { ensureSeedAdmin, ensureCategories, importJpkUpdates } from './seed.js';
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
    try {
      await ensureCategories();
    } catch (err) {
      console.error('[jpk-admin] could not add the product categories:', err && err.message);
    }
    const problem = cloudinaryProblem();
    if (problem) {
      // the 6 posts have pictures: wait for working Cloudinary settings (checked again at the next start or sign-in)
      if (!state.warned) console.error(`[jpk-admin] ${problem} The existing JPK Updates posts are added once this is fixed.`);
      state.warned = true;
      return;
    }
    try {
      const r = await importJpkUpdates();
      if (r.status === 'imported') console.log(`[jpk-admin] Added ${r.count} existing JPK Updates posts.`);
    } catch (err) {
      console.error('[jpk-admin] could not add the existing JPK Updates posts (will retry):', err && err.message);
    }
  })().finally(() => {
    state.running = null;
  });
  return state.running;
}
