import { connectDB } from '@/lib/db';
import { json, readJson, adminRoute } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { requireUser, publicUser } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { isObjectId } from '@/lib/validate';
import { parseUser } from '@/lib/inputs';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

async function load(params) {
  const { id } = await params;
  if (!isObjectId(id)) throw new HttpError(404, 'This user does not exist.');
  await connectDB();
  const doc = await User.findById(id);
  if (!doc) throw new HttpError(404, 'This user does not exist (they may have been deleted).');
  return doc;
}

async function otherActiveAdmins(id) {
  return User.countDocuments({ _id: { $ne: id }, role: 'admin', active: true });
}

export const GET = adminRoute(async (req, { params }) => {
  await requireUser('admin');
  return json({ item: publicUser(await load(params)) });
});

// PATCH { name?, email?, role?, permissions?, active?, password? }
export const PATCH = adminRoute(async (req, { params }) => {
  const me = await requireUser('admin');
  const data = parseUser(await readJson(req, { maxBytes: 20_000 }), { partial: true });
  const doc = await load(params);
  const self = String(doc._id) === me.id;
  const losesAdmin = doc.role === 'admin' && doc.active && ((data.role && data.role !== 'admin') || data.active === false);
  if (self && losesAdmin) throw new HttpError(400, 'You cannot remove your own administrator access or switch off your own account. Ask another administrator.');
  if (losesAdmin && (await otherActiveAdmins(doc._id)) === 0) throw new HttpError(400, 'There must always be at least one active administrator.');
  if (data.email && data.email !== doc.email && (await User.exists({ email: data.email, _id: { $ne: doc._id } }))) {
    throw new HttpError(409, 'A user with this email address already exists.');
  }
  const { password, ...rest } = data;
  Object.assign(doc, rest);
  if (doc.role === 'admin') doc.permissions = {};
  let signOut = false;
  if (password) {
    doc.passwordHash = await hashPassword(password);
    doc.passwordChangedAt = new Date();
    signOut = true;
  }
  if (data.active === false) signOut = true;
  if (signOut && !self) doc.tokenVersion = (doc.tokenVersion || 0) + 1;
  await doc.save();
  return json({ item: publicUser(doc) });
});

export const DELETE = adminRoute(async (req, { params }) => {
  const me = await requireUser('admin');
  const doc = await load(params);
  if (String(doc._id) === me.id) throw new HttpError(400, 'You cannot delete your own account.');
  if (doc.role === 'admin' && doc.active && (await otherActiveAdmins(doc._id)) === 0) throw new HttpError(400, 'There must always be at least one active administrator.');
  await doc.deleteOne();
  return json({ ok: true });
});
