'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, Card, Field, Notice, Badge, Icon } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { useFormState } from '@/components/useFormState';
import RichEditor from '@/components/fields/RichEditor';
import SlugField, { slugify } from '@/components/fields/SlugField';
import { api } from '@/lib/client/api';
import { formatDate, toDateInput } from '@/lib/format';

const TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary', 'Apprenticeship'];
const lines = arr => (arr || []).join('\n');

function toForm(d = {}) {
  return {
    title: d.title || '',
    slug: d.slug || '',
    department: d.department || '',
    location: d.location || '',
    employmentType: d.employmentType || 'Full-time',
    experience: d.experience || '',
    summary: d.summary || '',
    description: d.description || '',
    responsibilities: lines(d.responsibilities),
    requirements: lines(d.requirements),
    openings: d.openings ?? 1,
    status: d.status || 'draft',
    closingDate: toDateInput(d.closingDate),
  };
}

export default function JobForm({ initial, applications = 0, siteUrl, departments = [], locations = [], perms }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const isNew = !initial;
  const [saved, setSaved] = useState(initial || null);
  const { form, set, reset, dirty } = useFormState(() => toForm(initial));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [busy, setBusy] = useState('');
  const [errors, setErrors] = useState({});
  const canEdit = isNew || perms.update;
  const status = saved ? saved.status : 'draft';
  const expired = form.closingDate && form.closingDate < toDateInput(new Date());

  const save = async next => {
    if (!form.title.trim()) {
      setErrors({ title: 'Please enter the job title.' });
      document.getElementById('title')?.focus();
      return;
    }
    if (next === 'closed' && !(await confirm({ title: 'Close this job?', message: 'It will be removed from the Careers page. You can publish it again later.', confirmLabel: 'Close job', tone: 'primary' }))) return;
    setErrors({});
    setBusy(next);
    try {
      const payload = { ...form, status: next, closingDate: form.closingDate || null };
      if (isNew) {
        const { item } = await api('/api/admin/jobs', { method: 'POST', body: payload });
        reset(toForm(item));
        toast.success(next === 'published' ? 'Job published on the Careers page.' : 'Job saved as a draft.');
        router.replace(`/admin/jobs/${item._id}`);
      } else {
        const { item } = await api(`/api/admin/jobs/${saved._id}`, { method: 'PATCH', body: payload });
        setSaved(item);
        reset(toForm(item));
        toast.success(next === 'published' ? 'Job saved and shown on the Careers page.' : next === 'closed' ? 'Job closed.' : 'Job saved as a draft.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Delete this job?', message: `“${saved.title}” will be removed. Applications already received are kept.`, confirmLabel: 'Delete job' }))) return;
    setBusy('delete');
    try {
      await api(`/api/admin/jobs/${saved._id}`, { method: 'DELETE' });
      reset(form);
      toast.success('Job deleted.');
      router.push('/admin/jobs');
    } catch (err) {
      toast.error(err.message);
      setBusy('');
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: '/admin/jobs', label: 'Job openings' }}
        title={isNew ? 'New job opening' : form.title || 'Edit job'}
        actions={!isNew && perms.applications ? <Link href={`/admin/applications?job=${saved._id}`} className="btn btn--ghost"><Icon name="applications" size={16} />{applications} application{applications === 1 ? '' : 's'}</Link> : null}
      />
      {!canEdit ? <Notice tone="info" title="Read only">You can see this job but your account cannot change it.</Notice> : null}
      <form onSubmit={e => { e.preventDefault(); if (canEdit) save(status === 'published' ? 'published' : status); }} noValidate>
        <fieldset className="plain" disabled={!canEdit || Boolean(busy)}>
          <div className="editor-grid">
            <div>
              <Card>
                <Field label="Job title" required htmlFor="title" error={errors.title}>
                  <input id="title" className="input input--lg" value={form.title} onChange={e => { set('title', e.target.value); if (errors.title) setErrors({}); if (!slugTouched) set('slug', slugify(e.target.value)); }} maxLength={160} placeholder="e.g. Quality Control Engineer" />
                </Field>
                <Field label="Short summary" htmlFor="summary" hint="Two or three sentences shown first on the Careers page.">
                  <textarea id="summary" className="textarea" rows={3} value={form.summary} onChange={e => set('summary', e.target.value)} maxLength={600} />
                </Field>
                <Field label="Description">
                  <RichEditor value={form.description} onChange={v => set('description', v)} folder="careers" disabled={!canEdit} minHeight={200} placeholder="About the role, the team and what we offer." />
                </Field>
                <div className="form-row">
                  <Field label="Responsibilities" htmlFor="responsibilities" hint="One per line">
                    <textarea id="responsibilities" className="textarea" rows={7} value={form.responsibilities} onChange={e => set('responsibilities', e.target.value)} placeholder={'Inspect castings against drawings\nMaintain quality records'} />
                  </Field>
                  <Field label="Requirements" htmlFor="requirements" hint="One per line">
                    <textarea id="requirements" className="textarea" rows={7} value={form.requirements} onChange={e => set('requirements', e.target.value)} placeholder={'Diploma or B.E. in Metallurgy\n2+ years in a foundry'} />
                  </Field>
                </div>
              </Card>
            </div>
            <div className="editor-grid__side">
              <Card title="Publish">
                <p style={{ marginBottom: 14 }}>
                  {expired && status === 'published' ? <Badge tone="grey">Closing date passed</Badge> : <Badge status={status} />}{' '}
                  <span className="muted small">{status === 'published' && !expired ? 'shown on the Careers page' : 'not shown on the website'}</span>
                </p>
                {saved && saved.publishedAt ? <p className="field__hint" style={{ marginBottom: 12 }}>First published {formatDate(saved.publishedAt)}</p> : null}
                {canEdit ? (
                  <div className="actions-row">
                    <button type="button" className="btn btn--accent" onClick={() => save('published')} disabled={Boolean(busy)}>{busy === 'published' ? 'Saving…' : status === 'published' ? 'Update' : 'Publish'}</button>
                    {status !== 'published' ? <button type="button" className="btn btn--ghost" onClick={() => save(status === 'closed' ? 'closed' : 'draft')} disabled={Boolean(busy)}>{busy === 'draft' || busy === 'closed' ? 'Saving…' : 'Save'}</button> : null}
                    {status === 'published' ? <button type="button" className="btn btn--ghost" onClick={() => save('closed')} disabled={Boolean(busy)}>{busy === 'closed' ? 'Saving…' : 'Close job'}</button> : null}
                  </div>
                ) : null}
                {dirty && canEdit ? <p className="field__hint" style={{ marginTop: 10 }}>You have unsaved changes.</p> : null}
              </Card>
              <Card title="Details">
                <Field label="Department" htmlFor="department">
                  <input id="department" className="input" list="job-departments" value={form.department} onChange={e => set('department', e.target.value)} maxLength={100} />
                  <datalist id="job-departments">{[...new Set(['Production', 'Quality', 'Engineering', 'Sales & Marketing', 'Exports', 'Finance & Accounts', 'Human Resources', 'Maintenance', 'Supply Chain', ...departments])].map(d => <option key={d} value={d} />)}</datalist>
                </Field>
                <Field label="Location" htmlFor="location">
                  <input id="location" className="input" list="job-locations" value={form.location} onChange={e => set('location', e.target.value)} maxLength={120} />
                  <datalist id="job-locations">{[...new Set(['Kolkata (Head office)', 'Uluberia, Howrah (Factory)', ...locations])].map(d => <option key={d} value={d} />)}</datalist>
                </Field>
                <div className="form-row">
                  <Field label="Type" htmlFor="employmentType">
                    <select id="employmentType" className="select" value={form.employmentType} onChange={e => set('employmentType', e.target.value)}>
                      {[...new Set([...TYPES, form.employmentType].filter(Boolean))].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Openings" htmlFor="openings">
                    <input id="openings" className="input" type="number" min="0" max="999" value={form.openings} onChange={e => set('openings', e.target.value)} />
                  </Field>
                </div>
                <Field label="Experience" htmlFor="experience" hint="e.g. 2–5 years">
                  <input id="experience" className="input" value={form.experience} onChange={e => set('experience', e.target.value)} maxLength={60} />
                </Field>
                <Field label="Closing date" htmlFor="closingDate" hint="Last day to apply. Leave empty to keep it open.">
                  <input id="closingDate" className="input" type="date" value={form.closingDate} onChange={e => set('closingDate', e.target.value)} />
                </Field>
                <SlugField value={form.slug} onChange={v => { setSlugTouched(true); set('slug', v); }} published={status === 'published'} disabled={!canEdit} />
              </Card>
              {!isNew && perms.delete ? (
                <Card title="Delete job" className="danger-zone">
                  <p className="muted small" style={{ marginBottom: 12 }}>Applications already received are kept.</p>
                  <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={remove} disabled={Boolean(busy)}>{busy === 'delete' ? 'Deleting…' : 'Delete this job'}</button>
                </Card>
              ) : null}
            </div>
          </div>
        </fieldset>
      </form>
      {dialog}
    </>
  );
}
