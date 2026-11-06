import { connectDB } from '@/lib/db';
import { json, adminRoute } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { canUpload } from '@/lib/permissions';
import { isObjectId } from '@/lib/validate';
import { releaseImages, imageInUse } from '@/lib/storage';
import { Media } from '@/models/Media';

export const dynamic = 'force-dynamic';

// DELETE /api/admin/media/<id> -> removes a picture from the library, and from storage when nothing uses it
export const DELETE = adminRoute(async (req, ctx) => {
  const user = await requireUser();
  if (!canUpload(user)) throw new HttpError(403, 'You do not have permission to use the picture library.');
  const { id } = await ctx.params;
  if (!isObjectId(id)) throw new HttpError(404, 'This picture is not in the library.');
  await connectDB();
  const item = await Media.findById(id).lean();
  if (!item) throw new HttpError(404, 'This picture is not in the library.');
  const where = await imageInUse(item.url, item.publicId);
  if (where) throw new HttpError(409, `This picture is still used (${where}). Replace it there first.`);
  await Media.deleteOne({ _id: id });
  await releaseImages([{ url: item.url, publicId: item.publicId, provider: item.provider }]);
  return json({ ok: true });
});
