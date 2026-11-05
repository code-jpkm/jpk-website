import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { can } from '@/lib/permissions';
import { websiteUrl } from '@/lib/present';
import { ToastProvider } from '@/components/Toast';
import AdminShell from '@/components/AdminShell';
import SystemProblem from '@/components/SystemProblem';
import { Application } from '@/models/Application';
import { Enquiry } from '@/models/Enquiry';

async function badgesFor(user) {
  await connectDB();
  const [applications, enquiries] = await Promise.all([
    can(user, 'applications') ? Application.countDocuments({ status: 'new' }) : 0,
    can(user, 'enquiries') ? Enquiry.countDocuments({ status: 'new' }) : 0,
  ]);
  return { applications, enquiries };
}

export default async function AdminLayout({ children }) {
  let user;
  try {
    user = await getSessionUser();
  } catch (err) {
    return <SystemProblem error={err} />;
  }
  if (!user) redirect('/login');
  const badges = await badgesFor(user).catch(() => ({}));
  return (
    <ToastProvider>
      <AdminShell user={user} badges={badges} siteUrl={websiteUrl()}>{children}</AdminShell>
    </ToastProvider>
  );
}
