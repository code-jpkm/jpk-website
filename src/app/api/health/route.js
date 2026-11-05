import mongoose from 'mongoose';
import { connectDB, dbConfigured } from '@/lib/db';
import { cloudinaryEnabled, cloudinaryProblem } from '@/lib/cloudinarySettings';
import { mailEnabled } from '@/lib/mail';

export const dynamic = 'force-dynamic';

// GET /api/health: is the server up, can it reach the database, which services are set up.
// Always answers 200 while the server runs (used by Render's health check).
export async function GET() {
  let db = 'not-configured';
  if (dbConfigured()) {
    try {
      await connectDB();
      await mongoose.connection.db.admin().command({ ping: 1 });
      db = 'connected';
    } catch {
      db = 'unreachable';
    }
  }
  return Response.json(
    {
      ok: true,
      db,
      // "cloudinary-settings-problem": Cloudinary settings given but unusable; the dashboard says what to fix
      storage: cloudinaryEnabled() ? 'cloudinary' : cloudinaryProblem() ? 'cloudinary-settings-problem' : 'database',
      email: mailEnabled(),
      time: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } },
  );
}
