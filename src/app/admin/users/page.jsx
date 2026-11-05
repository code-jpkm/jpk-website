import { requirePageUser, publicUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { NoAccess } from '@/components/ui';
import { User } from '@/models/User';
import UserList from './UserList';

export const metadata = { title: 'Users & access' };

export default async function UsersPage() {
  const { user, allowed } = await requirePageUser('admin');
  if (!allowed) return <NoAccess what="users and access" />;
  await connectDB();
  const users = (await User.find({}).sort({ role: 1, name: 1 }).lean()).map(publicUser);
  return <UserList users={users} me={user.id} />;
}
