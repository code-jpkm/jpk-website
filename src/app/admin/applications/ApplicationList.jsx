'use client';

import Link from 'next/link';
import { useList } from '@/components/useList';
import { useToast } from '@/components/Toast';
import ListState from '@/components/ListState';
import Pagination from '@/components/Pagination';
import { PageHeader, Card, Badge, EmptyState, Icon, statusLabel } from '@/components/ui';
import { api, qs } from '@/lib/client/api';
import { formatDate, timeAgo } from '@/lib/format';

export const APPLICATION_STATUSES = ['new', 'reviewing', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];

export default function ApplicationList({ jobs, initial, perms }) {
  const list = useList('/api/admin/applications', { q: '', status: initial.status, job: initial.job });
  const toast = useToast();

  const setStatus = async (a, status) => {
    list.setItems(items => items.map(i => (i._id === a._id ? { ...i, status } : i)));
    try {
      await api(`/api/admin/applications/${a._id}`, { method: 'PATCH', body: { status } });
      toast.success(`${a.name}: ${statusLabel(status)}`);
    } catch (err) {
      list.setItems(items => items.map(i => (i._id === a._id ? { ...i, status: a.status } : i)));
      toast.error(err.message);
    }
  };

  const { q, status, job } = list.filters;
  const filtered = Boolean(q || status || job);
  return (
    <>
      <PageHeader
        title="Job applications"
        description="Applications and CVs sent from the Careers page."
        actions={<a href={`/api/admin/applications/export${qs({ q, status, job })}`} className="btn btn--ghost"><Icon name="download" size={16} />Download as Excel (CSV)</a>}
      />
      <Card pad={false}>
        <div className="toolbar">
          <div className="toolbar__search">
            <input className="input" type="search" placeholder="Search by name, email, phone…" value={q} onChange={e => list.update({ q: e.target.value })} aria-label="Search applications" />
          </div>
          <select className="select" value={job} onChange={e => list.update({ job: e.target.value })} aria-label="Position">
            <option value="">All positions</option>
            <option value="general">General applications</option>
            {jobs.map(j => <option key={j._id} value={j._id}>{j.title}{j.status !== 'published' ? ` (${statusLabel(j.status).toLowerCase()})` : ''}</option>)}
          </select>
          <select className="select" value={status} onChange={e => list.update({ status: e.target.value })} aria-label="Status">
            <option value="">Any status</option>
            {APPLICATION_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </div>
        <ListState
          list={list}
          empty={<EmptyState title={filtered ? 'No applications match' : 'No applications yet'} text={filtered ? 'Try other filters.' : 'Applications sent from the Careers page of the website will appear here.'} />}
        >
          <table className="table">
            <thead>
              <tr><th>Applicant</th><th className="hide-sm">Position</th><th className="hide-sm">Experience</th><th>Received</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {list.items.map(a => (
                <tr key={a._id} className={a.status === 'new' ? 'is-new' : ''}>
                  <td>
                    <Link href={`/admin/applications/${a._id}`} className="table__title">{a.name}</Link>
                    <span className="table__sub">{a.email}{a.phone ? ` · ${a.phone}` : ''}</span>
                  </td>
                  <td className="small hide-sm">{a.jobTitle}{a.location ? <span className="table__sub">{a.location}</span> : null}</td>
                  <td className="small hide-sm">{a.experience || '—'}</td>
                  <td className="nowrap" title={formatDate(a.createdAt, true)}>{timeAgo(a.createdAt)}</td>
                  <td>
                    {perms.update ? (
                      <select className="select status-select input--sm" value={a.status} onChange={e => setStatus(a, e.target.value)} aria-label={`Status of ${a.name}`} style={{ minHeight: 34, paddingTop: 4, paddingBottom: 4 }}>
                        {APPLICATION_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                      </select>
                    ) : <Badge status={a.status} />}
                  </td>
                  <td>
                    <div className="table__actions">
                      {a.resume && a.resume.fileId ? <a href={`/api/admin/applications/${a._id}/resume`} className="icon-btn" title="Download CV" aria-label={`Download CV of ${a.name}`}><Icon name="download" size={15} /></a> : null}
                      <Link href={`/admin/applications/${a._id}`} className="btn btn--ghost btn--sm">Open</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListState>
        <Pagination page={list.filters.page} pages={list.pages} total={list.total} onPage={list.setPage} noun="applications" />
      </Card>
    </>
  );
}
