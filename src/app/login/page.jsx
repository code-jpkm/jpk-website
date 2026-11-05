import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { dbConfigured } from '@/lib/db';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }) {
  let user = null;
  try {
    user = await getSessionUser();
  } catch {
    user = null; // database not reachable: show the form, the sign-in will explain
  }
  if (user) redirect('/admin');
  const sp = (await searchParams) || {};
  return <LoginForm expired={sp.expired === '1'} configured={dbConfigured()} />;
}
