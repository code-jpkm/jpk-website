import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { can } from '@/lib/permissions';
import { plain } from '@/lib/http';
import { isObjectId } from '@/lib/validate';
import { websiteUrl } from '@/lib/present';
import { NoAccess } from '@/components/ui';
import { Enquiry } from '@/models/Enquiry';
import EnquiryDetail from './EnquiryDetail';

export const metadata = { title: 'Enquiry' };

export default async function EnquiryPage({ params }) {
  const { user, allowed } = await requirePageUser('enquiries');
  if (!allowed) return <NoAccess what="enquiries" />;
  const { id } = await params;
  if (!isObjectId(id)) notFound();
  await connectDB();
  const enquiry = await Enquiry.findById(id).lean();
  if (!enquiry) notFound();
  return <EnquiryDetail key={String(enquiry._id)} initial={plain(enquiry)} siteUrl={websiteUrl()} perms={{ update: can(user, 'enquiries', 'update'), delete: can(user, 'enquiries', 'delete') }} />;
}
