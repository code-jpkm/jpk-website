'use client';

import Link from 'next/link';
import { useList } from '@/components/useList';
import ListState from '@/components/ListState';
import Pagination from '@/components/Pagination';
import { PageHeader, Card, Badge, EmptyState, Icon, statusLabel } from '@/components/ui';
import { qs } from '@/lib/client/api';
import { formatDate, timeAgo } from '@/lib/format';

export const ENQUIRY_STATUSES = ['new', 'read', 'replied', 'closed'];

export default function EnquiryList({ initial, perms, siteUrl }) {
  const list = useList('/api/admin/enquiries', { q: '', status: initial.status, form: '' });
  const { q, status, form } = list.filters;
  const filtered = Boolean(q || status || form);
  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Messages sent from the enquiry and contact forms on the website."
        actions={<a href={`/api/admin/enquiries/export${qs({ q, status, form })}`} className="btn btn--ghost"><Icon name="download" size={16} />Download as Excel (CSV)</a>}
      />
      <Card pad={false}>
        <div className="toolbar">
          <div className="toolbar__search">
            <input className="input" type="search" placeholder="Search name, email, message…" value={q} onChange={e => list.update({ q: e.target.value })} aria-label="Search enquiries" />
          </div>
          <select className="select" value={form} onChange={e => list.update({ form: e.target.value })} aria-label="Form">
            <option value="">All forms</option>
            <option value="588">Contact us page</option>
            <option value="187">Product enquiry form</option>
          </select>
          <select className="select" value={status} onChange={e => list.update({ status: e.target.value })} aria-label="Status">
            <option value="">Any status</option>
            {ENQUIRY_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </div>
        <ListState list={list} empty={<EmptyState title={filtered ? 'No enquiries match' : 'No enquiries yet'} text={filtered ? 'Try other filters.' : 'Messages from the website forms will appear here.'} />}>
          <table className="table">
            <thead>
              <tr><th>From</th><th className="hide-sm">Message</th><th className="hide-sm">Form / page</th><th>Received</th><th>Status</th><th><span className="sr-only">Open</span></th></tr>
            </thead>
            <tbody>
              {list.items.map(e => (
                <tr key={e._id} className={e.status === 'new' ? 'is-new' : ''}>
                  <td>
                    <Link href={`/admin/enquiries/${e._id}`} className="table__title">{e.name}</Link>
                    <span className="table__sub">{e.email}</span>
                    {e.company || e.country ? <span className="table__sub">{[e.company, e.country].filter(Boolean).join(' · ')}</span> : null}
                  </td>
                  <td className="hide-sm" style={{ maxWidth: 380 }}>
                    {e.subject ? <strong className="table__sub" style={{ color: 'var(--navy)' }}>{e.subject}</strong> : null}
                    <span className="table__sub">{e.message}</span>
                  </td>
                  <td className="small hide-sm">
                    {e.formName || 'Website form'}
                    {e.page ? <a href={`${siteUrl}${e.page}`} target="_blank" rel="noopener noreferrer" className="table__sub">{e.page}</a> : null}
                  </td>
                  <td className="nowrap" title={formatDate(e.createdAt, true)}>{timeAgo(e.createdAt)}</td>
                  <td><Badge status={e.status} /></td>
                  <td><div className="table__actions"><Link href={`/admin/enquiries/${e._id}`} className="btn btn--ghost btn--sm">{perms.update && e.status === 'new' ? 'Read' : 'Open'}</Link></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListState>
        <Pagination page={list.filters.page} pages={list.pages} total={list.total} onPage={list.setPage} noun="enquiries" />
      </Card>
    </>
  );
}
