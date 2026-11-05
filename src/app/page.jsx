import { redirect } from 'next/navigation';

// The admin lives under /admin; signed-out visitors are sent on to /login from there.
export default function Home() {
  redirect('/admin');
}
