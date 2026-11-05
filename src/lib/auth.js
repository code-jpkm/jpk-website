import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';
import { connectDB } from './db.js';
import { User } from '../models/User.js';
import { HttpError } from './errors.js';
import { can, normalizePermissions, permissionMessage } from './permissions.js';

export const SESSION_COOKIE = 'jpk_admin_session';
const SESSION_DAYS = 7;

let warnedSecret = false;
function secretKey() {
  let secret = String(process.env.JWT_SECRET || process.env.AUTH_SECRET || '').trim();
  if (!secret) {
    if (!warnedSecret && process.env.NODE_ENV === 'production') {
      console.warn('[jpk-admin] JWT_SECRET is not set. Using a key derived from MONGODB_URI; set JWT_SECRET for best security.');
      warnedSecret = true;
    }
    secret = createHash('sha256').update(`jpk-admin-session|${process.env.MONGODB_URI || 'local-development'}`).digest('hex');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user) {
  return new SignJWT({ tv: user.tokenVersion || 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user._id || user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export function isHttps(req) {
  const proto = String(req.headers.get('x-forwarded-proto') || '').split(',')[0].trim();
  if (proto) return proto === 'https';
  return new URL(req.url).protocol === 'https:';
}

export function sessionCookie(req, token) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, sameSite: 'lax', path: '/', secure: isHttps(req), maxAge: SESSION_DAYS * 86400 };
}

export function clearedSessionCookie(req) {
  return { name: SESSION_COOKIE, value: '', httpOnly: true, sameSite: 'lax', path: '/', secure: isHttps(req), maxAge: 0 };
}

// The safe view of a user that the admin screens and APIs work with.
export function publicUser(u) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    permissions: normalizePermissions(u.permissions),
    active: u.active !== false,
    isSeed: Boolean(u.isSeed),
    passwordChangedAt: u.passwordChangedAt ? new Date(u.passwordChangedAt).toISOString() : null,
    lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
  };
}

async function readToken() {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value || null;
}

// The signed-in user, checked against the database on every request (so changes apply at once).
export const getSessionUser = cache(async () => {
  const token = await readToken();
  if (!token) return null;
  let payload;
  try {
    ({ payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] }));
  } catch {
    return null;
  }
  if (!payload.sub || !/^[a-f0-9]{24}$/i.test(payload.sub)) return null;
  await connectDB();
  const user = await User.findById(payload.sub).lean();
  if (!user || user.active === false || (user.tokenVersion || 0) !== payload.tv) return null;
  return publicUser(user);
});

// For API routes: the user, or a 401/403 error.
export async function requireUser(module, action = 'view') {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, 'Your session has ended. Please sign in again.');
  if (module === 'admin') {
    if (user.role !== 'admin') throw new HttpError(403, 'Only administrators can do this.');
  } else if (module && !can(user, module, action)) {
    throw new HttpError(403, permissionMessage(module, action));
  }
  return user;
}

// For admin pages: sends signed-out visitors to the login page.
export async function requirePageUser(module, action = 'view') {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  let allowed = true;
  if (module === 'admin') allowed = user.role === 'admin';
  else if (module) allowed = can(user, module, action);
  return { user, allowed };
}
