import { requirePageUser } from '@/lib/auth';
import { NoAccess } from '@/components/ui';
import UserForm from '../UserForm';

export const metadata = { title: 'New user' };

export default async function NewUserPage() {
  const { user, allowed } = await requirePageUser('admin');
  if (!allowed) return <NoAccess what="users and access" />;
  return <UserForm me={user.id} />;
}
