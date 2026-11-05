import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { line } from '@/lib/validate';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

// GET /api/auth/me: the signed-in user.
export const GET = adminRoute(async () => {
  const user = await requireUser();
  return json({ user });
});

// PATCH /api/auth/me { name }: change your own display name.
export const PATCH = adminRoute(async req => {
  const user = await requireUser();
  const body = await readJson(req, { maxBytes: 10_000 });
  const name = line(body.name, { max: 120, required: true, label: 'Name' });
  await connectDB();
  await User.updateOne({ _id: user.id }, { $set: { name } });
  return json({ user: { ...user, name } });
});
