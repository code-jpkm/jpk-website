// Runs once when the server starts: creates the first admin (sales@jpkm.in) and the starter content
// if the database is empty. It does not hold up the server; problems are written to the log.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
    console.warn('[jpk-admin] MONGODB_URI is not set: the admin cannot work until it is added.');
    return;
  }
  const { runStartupTasks } = await import('./lib/startup.js');
  runStartupTasks().catch(err => console.error('[jpk-admin] first-run setup failed (will retry on sign-in):', err && err.message));
}
