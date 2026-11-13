'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, Card, Field, Badge, Icon, statusLabel } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { api } from '@/lib/client/api';
import { formatDate } from '@/lib/format';
import { ENQUIRY_STATUSES } from '../EnquiryList';

export default function EnquiryDetail({ initial, siteUrl, perms }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [item, setItem] = useState(initial);
  const [status, setStatus] = useState(initial.status === 'new' && perms.update ? 'read' : initial.status);
  const [notes, setNotes] = useState(initial.notes || '');
  const [busy, setBusy] = useState('');
  const marked = useRef(false);

  // opening a new enquiry marks it as read
  useEffect(() => {
    if (marked.current || initial.status !== 'new' || !perms.update) return;
    marked.current = true;
    api(`/api/admin/enquiries/${initial._id}`, { method: 'PATCH', body: { status: 'read' } })
      .then(({ item: saved }) => { setItem(saved); router.refresh(); })
      .catch(() => setStatus('new'));
  }, [initial, perms.update, router]);

  const changed = status !== item.status || notes !== (item.notes || '');

  const save = async (nextStatus = status) => {
    setBusy('save');
    try {
      const { item: saved } = await api(`/api/admin/enquiries/${item._id}`, { method: 'PATCH', body: { status: nextStatus, notes } });
      setItem(saved);
      setStatus(saved.status);
      toast.success('Saved.');
      router.refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Delete this enquiry?', message: `The message from ${item.name} will be deleted for good.`, confirmLabel: 'Delete enquiry' }))) return;
    setBusy('delete');
    try {
      await api(`/api/admin/enquiries/${item._id}`, { method: 'DELETE' });
      toast.success('Enquiry deleted.');
      router.push('/admin/enquiries');
      router.refresh();
    } catch (err) {
      toast.error(err.message);
      setBusy('');
    }
  };

  const replySubject = encodeURIComponent(`Re: ${item.subject || 'Your enquiry to JPK Metallics'}`);
  const quoted = encodeURIComponent(`\n\n\n--- ${item.name} wrote on ${formatDate(item.createdAt, true)}:\n${item.message}`);
  return (
    <>
      <PageHeader
        back={{ href: '/admin/enquiries', label: 'Enquiries' }}
        title={item.subject || `Enquiry from ${item.name}`}
        description={<>From <strong>{item.name}</strong> · {formatDate(item.createdAt, true)} · {item.formName || 'Website form'}</>}
        actions={<a className="btn btn--primary" href={`mailto:${item.email}?subject=${replySubject}&body=${quoted}`} onClick={() => { if (perms.update && item.status !== 'replied') setStatus('replied'); }}><Icon name="mail" size={16} />Reply by email</a>}
      />
      <div className="editor-grid">
        <div>
          <Card title="Message">
            <div className="message-box">{item.message || '—'}</div>
          </Card>
          <Card title="Contact details">
            <dl className="detail-list">
              <dt>Name</dt><dd>{item.name}</dd>
              <dt>Email</dt><dd><a href={`mailto:${item.email}`}>{item.email}</a></dd>
              <dt>Phone</dt><dd>{item.phone ? <><a href={`tel:${item.phone.replace(/[^\d+]/g, '')}`}>{item.phone}</a>{item.phone.replace(/\D/g, '').length >= 10 ? <> · <a href={`https://wa.me/${item.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a></> : null}</> : '—'}</dd>
              {item.company ? <><dt>Company</dt><dd>{item.company}</dd></> : null}
              {item.country ? <><dt>Country</dt><dd>{item.country}</dd></> : null}
              {item.product ? <><dt>Product</dt><dd>{item.product}</dd></> : null}
              {item.quantity ? <><dt>Quantity</dt><dd>{item.quantity}</dd></> : null}
              <dt>Sent from</dt><dd>{item.page ? <a href={`${siteUrl}${item.page}`} target="_blank" rel="noopener noreferrer">{siteUrl.replace(/^https?:\/\//, '')}{item.page}</a> : '—'}</dd>
            </dl>
          </Card>
        </div>
        <div className="editor-grid__side">
          <Card title="Follow-up">
            <p style={{ marginBottom: 14 }}><Badge status={item.status} /></p>
            <fieldset className="plain" disabled={!perms.update || Boolean(busy)}>
              <Field label="Status" htmlFor="status">
                <select id="status" className="select" value={status} onChange={e => setStatus(e.target.value)}>
                  {ENQUIRY_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
              </Field>
              <Field label="Internal notes" htmlFor="notes" hint="Only visible in the admin.">
                <textarea id="notes" className="textarea" rows={5} value={notes} onChange={e => setNotes(e.target.value)} maxLength={6000} placeholder="Quotation sent, follow-up date…" />
              </Field>
              {perms.update ? <button type="button" className="btn btn--accent" onClick={() => save()} disabled={!changed || Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save'}</button> : null}
            </fieldset>
          </Card>
          {perms.delete ? (
            <Card title="Delete enquiry" className="danger-zone">
              <p className="muted small" style={{ marginBottom: 12 }}>Deletes this message for good.</p>
              <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={remove} disabled={Boolean(busy)}>{busy === 'delete' ? 'Deleting…' : 'Delete'}</button>
            </Card>
          ) : null}
        </div>
      </div>
      {dialog}
    </>
  );
}
