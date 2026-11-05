import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser, publicUser } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { parseUser } from '@/lib/inputs';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

// GET /api/admin/users (administrators only)
export const GET = adminRoute(async () => {
  await requireUser('admin');
  await connectDB();
  const users = await User.find({}).sort({ role: 1, name: 1 }).lean();
  return json({ items: users.map(publicUser) });
});

// POST /api/admin/users { name, email, password, role, permissions, active }
export const POST = adminRoute(async req => {
  const me = await requireUser('admin');
  const data = parseUser(await readJson(req, { maxBytes: 20_000 }));
  await connectDB();
  if (await User.exists({ email: data.email })) throw new HttpError(409, 'A user with this email address already exists.');
  const { password, ...rest } = data;
  const doc = await User.create({
    ...rest,
    permissions: rest.role === 'admin' ? {} : rest.permissions,
    active: 'active' in rest ? rest.active : true,
    passwordHash: await hashPassword(password),
    createdBy: me.id,
  });
  return json({ item: publicUser(doc) }, { status: 201 });
});
