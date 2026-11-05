import { requirePageUser } from '@/lib/auth';
import AccountForms from './AccountForms';

export const metadata = { title: 'My account' };

export default async function AccountPage() {
  const { user } = await requirePageUser();
  return <AccountForms user={user} />;
}
