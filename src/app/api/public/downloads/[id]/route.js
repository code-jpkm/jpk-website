import { Readable } from 'node:stream';
import { connectDB } from '@/lib/db';
import { gridFind, gridStream, DOWNLOAD_BUCKET } from '@/lib/storage';
import { isObjectId } from '@/lib/validate';
import { isDbDown } from '@/lib/errors';
import { Download } from '@/models/Download';

export const dynamic = 'force-dynamic';

// GET /api/public/downloads/<id>: the PDF of a published download (opens in the browser; "download" saves it)
export async function GET(req, { params }) {
  const { id } = await params;
  if (!isObjectId(id)) return new Response('Not found', { status: 404 });
  try {
    await connectDB();
    const d = await Download.findById(id).lean();
    if (!d || !d.published) return new Response('Not found', { status: 404 });
    const file = await gridFind(DOWNLOAD_BUCKET, d.fileId);
    if (!file) return new Response('Not found', { status: 404 });
    const etag = `"${d.fileId}"`;
    const base = {
      'Cache-Control': 'public, max-age=3600',
      ETag: etag,
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    };
    if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: base });
    const name = String(d.fileName || 'file.pdf').replace(/[^\w.\- ()]+/g, '_');
    const disposition = new URL(req.url).searchParams.has('download') ? 'attachment' : 'inline';
    return new Response(Readable.toWeb(gridStream(DOWNLOAD_BUCKET, d.fileId)), {
      headers: {
        ...base,
        'Content-Type': 'application/pdf',
        'Content-Length': String(file.length),
        'Content-Disposition': `${disposition}; filename="${name}"`,
      },
    });
  } catch (err) {
    return new Response(isDbDown(err) ? 'Temporarily unavailable' : 'Error', { status: isDbDown(err) ? 503 : 500 });
  }
}
