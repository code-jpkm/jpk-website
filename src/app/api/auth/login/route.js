import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { verifyPassword } from '@/lib/password';
import { signSession, sessionCookie, publicUser } from '@/lib/auth';
import { rateLimit, resetRateLimit, clientIp } from '@/lib/rateLimit';
import { ensureSeedAdmin } from '@/lib/seed';
import { runStartupTasks } from '@/lib/startup';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

// checked when the email is unknown, so both cases take the same time
const DUMMY_HASH = '$2b$10$RrOLMENRDSGY1G5/s6.HWeWDqmAMcZVnt9ZqNpca31Cc72le2sLRi';

// POST /api/auth/login { email, password }
export const POST = adminRoute(async req => {
  const body = await readJson(req, { maxBytes: 10_000 });
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) throw new HttpError(400, 'Please enter your email address and password.');

  const ip = clientIp(req);
  const byIp = rateLimit(`login-ip:${ip}`, { limit: 30, windowMs: 15 * 60 * 1000 });
  const byEmail = rateLimit(`login-email:${email}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!byIp.ok || !byEmail.ok) {
    throw new HttpError(429, 'Too many sign-in attempts. Please wait a few minutes and try again.', { retryAfter: Math.max(byIp.retryAfter, byEmail.retryAfter) });
  }

  await connectDB();
  // very first sign-in on a new database: create sales@jpkm.in
  await ensureSeedAdmin();

  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = await verifyPassword(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'The email address or password is not correct.');
  if (user.active === false) throw new HttpError(403, 'This account has been switched off. Please ask an administrator.');

  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  resetRateLimit(`login-email:${email}`);
  runStartupTasks().catch(() => {});

  const res = json({ ok: true, user: publicUser(user) });
  res.cookies.set(sessionCookie(req, await signSession(user)));
  return res;
});
