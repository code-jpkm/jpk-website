import { Readable } from 'node:stream';
import { gridFind, gridStream, MEDIA_BUCKET } from '@/lib/storage';
import { isObjectId } from '@/lib/validate';
import { isDbDown } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// GET /api/files/<id>: pictures kept in the database (used when Cloudinary is not set up). Public.
export async function GET(req, { params }) {
  const { id } = await params;
  if (!isObjectId(id)) return new Response('Not found', { status: 404 });
  try {
    if (req.headers.get('if-none-match') === `"${id}"`) {
      return new Response(null, { status: 304, headers: { ETag: `"${id}"`, 'Cache-Control': 'public, max-age=31536000, immutable' } });
    }
    const file = await gridFind(MEDIA_BUCKET, id);
    if (!file) return new Response('Not found', { status: 404 });
    const type = (file.metadata && file.metadata.contentType) || file.contentType || 'application/octet-stream';
    if (!type.startsWith('image/')) return new Response('Not found', { status: 404 });
    const body = Readable.toWeb(gridStream(MEDIA_BUCKET, id));
    return new Response(body, {
      headers: {
        'Content-Type': type,
        'Content-Length': String(file.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: `"${id}"`,
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (err) {
    return new Response(isDbDown(err) ? 'Temporarily unavailable' : 'Error', { status: isDbDown(err) ? 503 : 500 });
  }
}
