import { json, adminRoute } from '@/lib/http';
import { clearedSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/auth/logout
export const POST = adminRoute(async req => {
  const res = json({ ok: true });
  res.cookies.set(clearedSessionCookie(req));
  return res;
});
