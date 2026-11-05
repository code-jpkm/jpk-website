import { Readable } from 'node:stream';
import { connectDB } from '@/lib/db';
import { adminRoute } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser } from '@/lib/auth';
import { isObjectId } from '@/lib/validate';
import { gridFind, gridStream, RESUME_BUCKET } from '@/lib/storage';
import { Application } from '@/models/Application';

export const dynamic = 'force-dynamic';

// GET /api/admin/applications/<id>/resume[?view=1]: the applicant's CV (signed-in users with access only).
export const GET = adminRoute(async (req, { params }) => {
  await requireUser('applications', 'view');
  const { id } = await params;
  if (!isObjectId(id)) throw new HttpError(404, 'This application does not exist.');
  await connectDB();
  const app = await Application.findById(id).select('name resume').lean();
  if (!app || !app.resume || !app.resume.fileId) throw new HttpError(404, 'No CV was attached to this application.');
  const file = await gridFind(RESUME_BUCKET, app.resume.fileId);
  if (!file) throw new HttpError(404, 'The CV file could not be found.');
  const type = app.resume.mimeType || (file.metadata && file.metadata.contentType) || 'application/octet-stream';
  const ext = (app.resume.filename.match(/\.[a-z0-9]+$/i) || ['.pdf'])[0].toLowerCase();
  const nice = `CV - ${app.name}`.replace(/[^\w .()-]+/g, '').slice(0, 80) + ext;
  const view = new URL(req.url).searchParams.get('view') === '1' && type === 'application/pdf';
  return new Response(Readable.toWeb(gridStream(RESUME_BUCKET, app.resume.fileId)), {
    headers: {
      'Content-Type': type,
      'Content-Length': String(file.length),
      'Content-Disposition': `${view ? 'inline' : 'attachment'}; filename="${nice}"; filename*=UTF-8''${encodeURIComponent(nice)}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
