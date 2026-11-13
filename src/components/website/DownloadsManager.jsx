'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, sendForm } from '@/lib/client/api';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { PageHeader, Card, Field, Notice, Spinner, Badge } from '@/components/ui';

const CATEGORIES = [['catalogue', 'Catalogue'], ['certificate', 'Certificate'], ['brochure', 'Brochure'], ['datasheet', 'Data sheet'], ['other', 'Other']];
const label = c => (CATEGORIES.find(x => x[0] === c) || [c, c])[1];
const mb = n => `${(n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1)} MB`;

// Website › Downloads: PDFs the website offers on its Downloads page (catalogues, certificates, data sheets).
export default function DownloadsManager({ websiteUrl, perms }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', category: 'catalogue', description: '' });
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState(null);
  const fileRef = useRef(null);

  const load = () => api('/api/admin/downloads').then(r => setItems(r.items)).catch(err => setError(err.message));
  useEffect(() => { load(); }, []);

  const upload = async e => {
    e.preventDefault();
    if (!file) { toast.error('Please choose a PDF file.'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', form.title);
    fd.append('category', form.category);
    fd.append('description', form.description);
    fd.append('published', 'true');
    setProgress(0);
    try {
      await sendForm('/api/admin/downloads', fd, { onProgress: setProgress });
      toast.success('Uploaded. The file is on the website’s Downloads page now.');
      setForm({ title: '', category: form.category, description: '' });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProgress(null);
    }
  };

  const patch = async (d, body, msg) => {
    setBusy(d._id);
    try {
      await api(`/api/admin/downloads/${d._id}`, { method: 'PATCH', body });
      if (msg) toast.success(msg);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };
  const remove = async d => {
    if (!(await confirm({ title: `Delete “${d.title}”?`, message: 'The PDF is removed from the website and from the admin. This cannot be undone.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    setBusy(d._id);
    try {
      await api(`/api/admin/downloads/${d._id}`, { method: 'DELETE' });
      toast.success('Deleted.');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };
  const replace = async (d, f) => {
    const fd = new FormData();
    fd.append('file', f);
    setBusy(d._id);
    try {
      await sendForm(`/api/admin/downloads/${d._id}`, fd, { method: 'PATCH' });
      toast.success('The new PDF replaces the old one; its address stays the same.');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <PageHeader title="Downloads" back={{ href: '/admin/website', label: 'Website' }}
        description={<>PDF catalogues, certificates and data sheets for buyers. They are listed on the website’s <a href={`${websiteUrl}/downloads/`} target="_blank" rel="noopener noreferrer">Downloads page ↗</a>, newest category first; Google and AI tools can read them too.</>} />
      {error ? <Notice tone="danger" title="The downloads could not be loaded.">{error}</Notice> : null}
      <div className="editor-grid">
        <div>
          <Card title="Files on the website">
            {!items ? <Spinner /> : !items.length ? (
              <p className="muted">No files yet. Upload the product catalogue and your certificates (BSI Kitemark, ISO, ICMQ) here: buyers often ask for them before they enquire.</p>
            ) : (
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {items.map(d => (
                      <tr key={d._id}>
                        <td>
                          {editing === d._id ? (
                            <EditRow d={d} onCancel={() => setEditing(null)} onSave={body => { setEditing(null); patch(d, body, 'Saved.'); }} />
                          ) : (
                            <>
                              <span className="table__title">{d.title}</span>
                              <span className="table__sub">{d.description || d.fileName}</span>
                              <span className="table__sub">Uploaded {formatDate(d.createdAt)}{d.updatedAt && d.updatedAt !== d.createdAt ? ` · changed ${formatDate(d.updatedAt)}` : ''}</span>
                            </>
                          )}
                        </td>
                        <td className="small">{label(d.category)}</td>
                        <td className="small nowrap">{mb(d.size || 0)}</td>
                        <td><Badge status={d.published ? 'published' : 'draft'}>{d.published ? 'On the website' : 'Hidden'}</Badge></td>
                        <td className="table__actions">
                          <a className="btn btn--ghost btn--sm" href={`/api/public/downloads/${d._id}`} target="_blank" rel="noopener noreferrer">{d.published ? 'Open ↗' : 'Open'}</a>
                          {perms.update ? <button type="button" className="btn btn--ghost btn--sm" disabled={busy === d._id} onClick={() => setEditing(d._id)}>Edit</button> : null}
                          {perms.update ? <button type="button" className="btn btn--ghost btn--sm" disabled={busy === d._id} onClick={() => patch(d, { published: !d.published }, d.published ? 'Hidden from the website.' : 'Shown on the website.')}>{d.published ? 'Hide' : 'Show'}</button> : null}
                          {perms.update ? (
                            <label className="btn btn--ghost btn--sm" title="Upload a new version of this PDF">
                              Replace
                              <input type="file" accept="application/pdf,.pdf" hidden onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) replace(d, f); }} />
                            </label>
                          ) : null}
                          {perms.delete ? <button type="button" className="btn btn--ghost btn--sm btn--danger-text" disabled={busy === d._id} onClick={() => remove(d)}>Delete</button> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <div className="editor-grid__side">
          {perms.create ? (
            <Card title="Add a PDF">
              <form onSubmit={upload}>
                <fieldset className="plain" disabled={progress !== null}>
                  <Field label="Title" htmlFor="dl-title" required hint="As buyers will see it, e.g. Ductile Iron Manhole Covers – Catalogue 2026.">
                    <input id="dl-title" className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={160} required />
                  </Field>
                  <Field label="Type" htmlFor="dl-cat">
                    <select id="dl-cat" className="select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Short description" htmlFor="dl-desc" hint="Optional: what is inside, e.g. sizes, load classes A15–D400, BS EN 124.">
                    <textarea id="dl-desc" className="textarea" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={400} />
                  </Field>
                  <Field label="PDF file" htmlFor="dl-file" required hint="Up to 20 MB.">
                    <input id="dl-file" ref={fileRef} type="file" accept="application/pdf,.pdf" className="input" onChange={e => setFile((e.target.files && e.target.files[0]) || null)} required />
                  </Field>
                  <button type="submit" className="btn btn--accent">{progress !== null ? `Uploading… ${progress}%` : 'Upload'}</button>
                </fieldset>
              </form>
            </Card>
          ) : null}
          <Card title="Tips">
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Use a clear file name and title: Google shows them in its results.</li>
              <li>Keep each catalogue under 10 MB if you can, so it opens quickly on phones.</li>
              <li>“Replace” keeps the same web address, so links in emails stay right.</li>
              <li>Other pages can link to a file: copy its address with “Open”.</li>
            </ul>
          </Card>
        </div>
      </div>
      <p className="small muted">The website’s Downloads page is also in its menu and sitemap once there is at least one file. See also <Link href="/admin/website">Website</Link>.</p>
      {confirmDialog}
    </>
  );
}

function EditRow({ d, onSave, onCancel }) {
  const [title, setTitle] = useState(d.title);
  const [category, setCategory] = useState(d.category);
  const [description, setDescription] = useState(d.description || '');
  return (
    <div className="dl-edit">
      <input className="input input--sm" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} aria-label="Title" />
      <select className="select input--sm" value={category} onChange={e => setCategory(e.target.value)} aria-label="Type">
        {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <textarea className="textarea" rows={2} value={description} onChange={e => setDescription(e.target.value)} maxLength={400} aria-label="Short description" />
      <div className="dl-edit__actions">
        <button type="button" className="btn btn--primary btn--sm" onClick={() => onSave({ title, category, description })}>Save</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
