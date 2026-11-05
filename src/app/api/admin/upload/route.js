import { json, adminRoute } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { canUpload } from '@/lib/permissions';
import { storeImage, MAX_IMAGE_UPLOAD } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const FOLDERS = ['jpk-updates', 'products', 'categories', 'careers', 'misc'];

// POST /api/admin/upload (multipart: file, folder) -> { image: { url, publicId, provider, width, height } }
export const POST = adminRoute(async req => {
  const user = await requireUser();
  if (!canUpload(user)) throw new HttpError(403, 'You do not have permission to upload pictures.');
  const size = Number(req.headers.get('content-length') || 0);
  if (size > MAX_IMAGE_UPLOAD + 512 * 1024) throw new HttpError(413, 'Pictures must be smaller than 25 MB.');
  let form;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, 'The picture could not be read. Please try again.');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size) throw new HttpError(400, 'Please choose a picture to upload.');
  const folder = FOLDERS.includes(form.get('folder')) ? form.get('folder') : 'misc';
  const buffer = Buffer.from(await file.arrayBuffer());
  const image = await storeImage(buffer, { folder, filename: file.name });
  return json({ image: { ...image, alt: '' } }, { status: 201 });
});
