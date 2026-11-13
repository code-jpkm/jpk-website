import { json, readJson, adminRoute } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { HttpError } from '@/lib/errors';
import { cleanWebsiteAddress, saveWebsiteAddress, websiteAddress } from '@/lib/siteAddress';
import { resetSchema } from '@/lib/site/schema';

export const dynamic = 'force-dynamic';

// The public website's address (Website › Website address).
// GET -> { address: { url, saved, fallback, fromEnv, local } }; PUT { url } -> saved ('' = back to the default)
export const GET = adminRoute(async () => {
  await requireUser('website', 'view');
  return json({ address: await websiteAddress() });
});

export const PUT = adminRoute(async req => {
  await requireUser('website', 'update');
  const body = await readJson(req, { maxBytes: 4000 });
  const raw = typeof body.url === 'string' ? body.url.trim() : '';
  if (raw && !cleanWebsiteAddress(raw)) throw new HttpError(400, 'Please enter the website address, for example https://jpkm.in or http://localhost:5173.');
  await saveWebsiteAddress(raw);
  resetSchema(); // the editor's list of pages is read from the website
  return json({ address: await websiteAddress() });
});
