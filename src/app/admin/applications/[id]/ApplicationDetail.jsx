'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, Card, Field, Badge, Icon, statusLabel } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { api } from '@/lib/client/api';
import { formatDate, formatBytes } from '@/lib/format';
import { APPLICATION_STATUSES } from '../ApplicationList';

export default function ApplicationDetail({ initial, perms }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [app, setApp] = useState(initial);
  const [status, setStatus] = useState(initial.status);
  const [notes, setNotes] = useState(initial.notes || '');
  const [busy, setBusy] = useState('');
  const changed = status !== app.status || notes !== (app.notes || '');
  const resume = app.resume && app.resume.fileId ? app.resume : null;
  const isPdf = resume && resume.mimeType === 'application/pdf';
  const job = app.job && typeof app.job === 'object' ? app.job : null;

  const save = async () => {
    setBusy('save');
    try {
      const { item } = await api(`/api/admin/applications/${app._id}`, { method: 'PATCH', body: { status, notes } });
      setApp({ ...app, ...item, job: app.job });
      toast.success('Saved.');
      router.refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Delete this application?', message: `The application and CV of ${app.name} will be deleted for good.`, confirmLabel: 'Delete application' }))) return;
    setBusy('delete');
    try {
      await api(`/api/admin/applications/${app._id}`, { method: 'DELETE' });
      toast.success('Application deleted.');
      router.push('/admin/applications');
      router.refresh();
    } catch (err) {
      toast.error(err.message);
      setBusy('');
    }
  };

  const subject = encodeURIComponent(`Your application for ${app.jobTitle} – JPK Metallics`);
  return (
    <>
      <PageHeader
        back={{ href: '/admin/applications', label: 'Applications' }}
        title={app.name}
        description={<>Applied for <strong>{app.jobTitle}</strong> on {formatDate(app.createdAt, true)}</>}
        actions={<a className="btn btn--primary" href={`mailto:${app.email}?subject=${subject}`}><Icon name="mail" size={16} />Email {app.name.split(' ')[0]}</a>}
      />
      <div className="editor-grid">
        <div>
          <Card title="Applicant">
            <dl className="detail-list">
              <dt>Email</dt><dd><a href={`mailto:${app.email}`}>{app.email}</a></dd>
              <dt>Phone</dt><dd>{app.phone ? <a href={`tel:${app.phone.replace(/[^\d+]/g, '')}`}>{app.phone}</a> : '—'}</dd>
              <dt>Location</dt><dd>{app.location || '—'}</dd>
              <dt>Experience</dt><dd>{app.experience || '—'}</dd>
              <dt>Current company</dt><dd>{app.currentCompany || '—'}</dd>
              <dt>LinkedIn</dt><dd>{app.linkedin ? <a href={app.linkedin} target="_blank" rel="noopener noreferrer nofollow">{app.linkedin.replace(/^https?:\/\/(www\.)?/, '')}</a> : '—'}</dd>
              <dt>Position</dt><dd>{job && perms.jobs ? <Link href={`/admin/jobs/${job._id}`}>{app.jobTitle}</Link> : app.jobTitle}</dd>
              <dt>Consent</dt><dd>{app.consent ? 'Agreed to JPK keeping the details for recruitment' : 'Not given'}</dd>
            </dl>
          </Card>
          <Card title="Cover letter">
            {app.coverLetter ? <div className="message-box">{app.coverLetter}</div> : <p className="muted">No cover letter was written.</p>}
          </Card>
        </div>
        <div className="editor-grid__side">
          <Card title="CV">
            {resume ? (
              <div className="file-card">
                <span className="file-card__icon">{(resume.filename.split('.').pop() || 'cv').toUpperCase()}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p className="file-card__name">{resume.filename}</p>
                  <p className="muted small">{formatBytes(resume.size)}</p>
                  <div className="actions-row" style={{ marginTop: 10 }}>
                    <a className="btn btn--primary btn--sm" href={`/api/admin/applications/${app._id}/resume`}><Icon name="download" size={15} />Download</a>
                    {isPdf ? <a className="btn btn--ghost btn--sm" href={`/api/admin/applications/${app._id}/resume?view=1`} target="_blank" rel="noopener noreferrer"><Icon name="eye" size={15} />Open</a> : null}
                  </div>
                </div>
              </div>
            ) : <p className="muted">No CV attached.</p>}
          </Card>
          <Card title="Progress">
            <p style={{ marginBottom: 14 }}><Badge status={app.status} /></p>
            <fieldset className="plain" disabled={!perms.update || Boolean(busy)}>
              <Field label="Status" htmlFor="status">
                <select id="status" className="select" value={status} onChange={e => setStatus(e.target.value)}>
                  {APPLICATION_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
              </Field>
              <Field label="Internal notes" htmlFor="notes" hint="Only visible in the admin.">
                <textarea id="notes" className="textarea" rows={5} value={notes} onChange={e => setNotes(e.target.value)} maxLength={6000} placeholder="Interview date, feedback, salary expectation…" />
              </Field>
              {perms.update ? <button type="button" className="btn btn--accent" onClick={save} disabled={!changed || Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save'}</button> : null}
            </fieldset>
          </Card>
          {perms.delete ? (
            <Card title="Delete application" className="danger-zone">
              <p className="muted small" style={{ marginBottom: 12 }}>Deletes the application and the CV for good.</p>
              <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={remove} disabled={Boolean(busy)}>{busy === 'delete' ? 'Deleting…' : 'Delete'}</button>
            </Card>
          ) : null}
        </div>
      </div>
      {dialog}
    </>
  );
}
