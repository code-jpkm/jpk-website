// Creates the first administrator (sales@jpkm.in / admin@123 unless SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
// are set) and the starter content. Safe to run again: existing data is never overwritten.
//
//   npm run seed                  create the admin if missing, add product categories and the 6 posts
//   npm run seed:reset-password   also put the seed admin's password back to the seed password
//
// The server also does this by itself on first start, so running this is optional.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(root, file));
  } catch {
    /* file not present */
  }
}
process.chdir(root);

const resetPassword = process.argv.includes('--reset-password');
const { ensureSeedAdmin, ensureCategories, importJpkUpdates, seedAdminEmail } = await import('../src/lib/seed.js');
const { disconnectDB, dbConfigured } = await import('../src/lib/db.js');
const { cloudinarySettings } = await import('../src/lib/cloudinarySettings.js');

if (!dbConfigured()) {
  console.error('MONGODB_URI is not set. Put it in .env.local (see .env.example) or in the environment, then run again.');
  process.exit(1);
}

// The 6 posts come with pictures, so check the picture settings before changing anything.
const cld = cloudinarySettings();
if (cld.problem) {
  console.error(cld.problem);
  console.error('Nothing was changed. Fix .env (or .env.local), then run npm run seed again.');
  process.exit(1);
}
console.log(cld.creds ? `Pictures: Cloudinary, cloud "${cld.creds.cloud_name}".` : 'Pictures: Cloudinary is not set up, so pictures are kept in MongoDB.');

try {
  const admin = await ensureSeedAdmin({ resetPassword, onlyWhenEmpty: false });
  const messages = {
    created: `Administrator created: ${admin.email}`,
    exists: `Administrator ${admin.email} already exists (password unchanged).`,
    reset: `Password of ${admin.email} was reset to the seed password.`,
    skipped: `Skipped creating ${seedAdminEmail()}.`,
  };
  console.log(messages[admin.status] || admin.status);
  const cats = await ensureCategories();
  console.log(cats.status === 'created' ? 'Product categories added.' : 'Product categories: already set up.');
  const posts = await importJpkUpdates();
  console.log(posts.status === 'imported' ? `JPK Updates: ${posts.count} existing posts added.` : 'JPK Updates: already set up.');
} catch (err) {
  console.error('Seeding stopped:', err && err.message);
  console.error('What was added so far is kept. Fix the problem, then run npm run seed again to finish.');
  process.exitCode = 1;
} finally {
  await disconnectDB().catch(() => {});
}
