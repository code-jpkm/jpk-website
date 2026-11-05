import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser, signSession, sessionCookie } from '@/lib/auth';
import { hashPassword, verifyPassword, passwordProblem } from '@/lib/password';
import { rateLimit } from '@/lib/rateLimit';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

// POST /api/auth/password { currentPassword, newPassword }
// Signs out your other sessions; this one stays signed in.
export const POST = adminRoute(async req => {
  const me = await requireUser();
  const rl = rateLimit(`password:${me.id}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.', { retryAfter: rl.retryAfter });
  const body = await readJson(req, { maxBytes: 10_000 });
  const current = String(body.currentPassword || '');
  const next = String(body.newPassword || '');
  const problem = passwordProblem(next);
  if (problem) throw new HttpError(400, problem);
  await connectDB();
  const user = await User.findById(me.id).select('+passwordHash');
  if (!user) throw new HttpError(401, 'Your session has ended. Please sign in again.');
  if (!(await verifyPassword(current, user.passwordHash))) throw new HttpError(400, 'Your current password is not correct.');
  if (await verifyPassword(next, user.passwordHash)) throw new HttpError(400, 'Please choose a password that is different from the current one.');
  user.passwordHash = await hashPassword(next);
  user.passwordChangedAt = new Date();
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  const res = json({ ok: true });
  res.cookies.set(sessionCookie(req, await signSession(user)));
  return res;
});
