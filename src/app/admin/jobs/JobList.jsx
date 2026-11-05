'use client';

import Link from 'next/link';
import { useList } from '@/components/useList';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import ListState from '@/components/ListState';
import Pagination from '@/components/Pagination';
import { PageHeader, Card, Badge, EmptyState, Icon } from '@/components/ui';
import { api } from '@/lib/client/api';
import { formatDate, toDateInput } from '@/lib/format';

function isExpired(job) {
  if (!job.closingDate) return false;
  return toDateInput(job.closingDate) < toDateInput(new Date());
}

export default function JobList({ perms, siteUrl }) {
  const list = useList('/api/admin/jobs', { q: '', status: '' });
  const toast = useToast();
  const [confirm, dialog] = useConfirm();

  const remove = async job => {
    if (!(await confirm({ title: 'Delete this job?', message: `“${job.title}” will be removed from the Careers page. Applications already received are kept.`, confirmLabel: 'Delete job' }))) return;
    try {
      await api(`/api/admin/jobs/${job._id}`, { method: 'DELETE' });
      toast.success('Job deleted.');
      list.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = Boolean(list.filters.q || list.filters.status);
  return (
    <>
      <PageHeader
        title="Job openings"
        description="Published openings appear on the Careers page of the website until their closing date."
        actions={
          <>
            <a href={`${siteUrl}/careers/`} target="_blank" rel="noopener noreferrer" className="btn btn--ghost"><Icon name="external" size={16} />Careers page</a>
            {perms.create ? <Link href="/admin/jobs/new" className="btn btn--accent"><Icon name="plus" size={16} />New job</Link> : null}
          </>
        }
      />
      <Card pad={false}>
        <div className="toolbar">
          <div className="toolbar__search">
            <input className="input" type="search" placeholder="Search by title, department or place" value={list.filters.q} onChange={e => list.update({ q: e.target.value })} aria-label="Search jobs" />
          </div>
          <select className="select" value={list.filters.status} onChange={e => list.update({ status: e.target.value })} aria-label="Status">
            <option value="">All jobs</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <ListState
          list={list}
          empty={
            <EmptyState
              title={filtered ? 'No jobs match' : 'No job openings yet'}
              text={filtered ? 'Try another search.' : 'While there are no openings, the Careers page invites general applications.'}
              action={perms.create && !filtered ? <Link href="/admin/jobs/new" className="btn btn--primary">Post a job</Link> : null}
            />
          }
        >
          <table className="table">
            <thead>
              <tr><th>Job</th><th className="hide-sm">Type</th><th>Status</th><th className="hide-sm">Closing date</th><th>Applications</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {list.items.map(j => {
                const expired = j.status === 'published' && isExpired(j);
                return (
                  <tr key={j._id}>
                    <td>
                      <Link href={`/admin/jobs/${j._id}`} className="table__title">{j.title}</Link>
                      <span className="table__sub">{[j.department, j.location].filter(Boolean).join(' · ') || '—'}</span>
                    </td>
                    <td className="small hide-sm">{j.employmentType || '—'}{j.experience ? <span className="table__sub">{j.experience}</span> : null}</td>
                    <td>{expired ? <Badge tone="grey">Closing date passed</Badge> : <Badge status={j.status} />}</td>
                    <td className="nowrap hide-sm">{j.closingDate ? formatDate(j.closingDate) : <span className="muted">No date</span>}</td>
                    <td>
                      {perms.applications ? (
                        <Link href={`/admin/applications?job=${j._id}`} className="nowrap">{j.applications}{j.newApplications ? <span className="badge badge--orange" style={{ marginLeft: 8 }}>{j.newApplications} new</span> : null}</Link>
                      ) : j.applications}
                    </td>
                    <td>
                      <div className="table__actions">
                        <Link href={`/admin/jobs/${j._id}`} className="btn btn--ghost btn--sm">{perms.update ? 'Edit' : 'Open'}</Link>
                        {perms.delete ? <button type="button" className="icon-btn icon-btn--danger" onClick={() => remove(j)} title="Delete" aria-label={`Delete ${j.title}`}><Icon name="trash" size={15} /></button> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ListState>
        <Pagination page={list.filters.page} pages={list.pages} total={list.total} onPage={list.setPage} noun="jobs" />
      </Card>
      {dialog}
    </>
  );
}
