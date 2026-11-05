import { notFound } from 'next/navigation';
import { requirePageUser, publicUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { isObjectId } from '@/lib/validate';
import { NoAccess } from '@/components/ui';
import { User } from '@/models/User';
import UserForm from '../UserForm';

export const metadata = { title: 'Edit user' };

export default async function EditUserPage({ params }) {
  const { user, allowed } = await requirePageUser('admin');
  if (!allowed) return <NoAccess what="users and access" />;
  const { id } = await params;
  if (!isObjectId(id)) notFound();
  await connectDB();
  const doc = await User.findById(id).lean();
  if (!doc) notFound();
  return <UserForm key={String(doc._id)} initial={publicUser(doc)} me={user.id} />;
}
