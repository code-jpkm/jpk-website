import { requirePageUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { websiteUrl } from '@/lib/present';
import { NoAccess } from '@/components/ui';
import { ENQUIRY_STATUSES } from '@/models/Enquiry';
import EnquiryList from './EnquiryList';

export const metadata = { title: 'Enquiries' };

export default async function EnquiriesPage({ searchParams }) {
  const { user, allowed } = await requirePageUser('enquiries');
  if (!allowed) return <NoAccess what="enquiries" />;
  const sp = (await searchParams) || {};
  const initial = { status: ENQUIRY_STATUSES.includes(sp.status) ? sp.status : '' };
  const perms = { update: can(user, 'enquiries', 'update'), delete: can(user, 'enquiries', 'delete') };
  return <EnquiryList key={initial.status || 'all'} initial={initial} perms={perms} siteUrl={await websiteUrl()} />;
}
