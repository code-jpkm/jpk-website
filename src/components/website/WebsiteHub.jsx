'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import { formatDate, timeAgo } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { PageHeader, Card, Badge, Notice, Field, Spinner, Icon } from '@/components/ui';
import AddressCard from './AddressCard';

// Website: every page with what was changed, the pages made here, and the header/footer, menu and design.
export default function WebsiteHub({ websiteUrl, perms }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => { api('/api/admin/site/pages').then(setState).catch(err => setError(err.message)); }, []);

  const last = m => (m && m.updatedAt ? `Changed ${timeAgo(m.updatedAt)}${m.updatedByName ? ` by ${m.updatedByName}` : ''}` : 'As built');
  const pages = state ? state.pages.filter(p => !q || `${p.name} ${p.path}`.toLowerCase().includes(q.toLowerCase())) : [];
  return (
    <div className="ws-hub">
      <PageHeader
        title="Website"
        description="Change any text, picture, link and section of the website, add sections and new pages, and arrange the menu. Saved changes are live on the website within seconds."
        actions={perms.create ? <button type="button" className="btn btn--accent" onClick={() => setAdding(true)}><Icon name="plus" />Add a page</button> : null}
      />
      {error ? <Notice tone="danger" title="The website pages could not be loaded.">{error}</Notice> : null}
      {state && state.source === 'bundled' ? (
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|[^/]+\.local(:|$))/i.test(websiteUrl) ? (
          <Notice tone="info" title="The list of pages comes with the admin.">
            The website address is on a computer of yours ({websiteUrl}), which the admin on the internet cannot reach. That is fine for testing: the admin uses its own copy of the list of pages, and the preview works on that computer.
          </Notice>
        ) : (
          <Notice tone="warn" title={`The list of pages comes with the admin: ${websiteUrl} could not be asked for its current list.`}>
            This is normal until the website is updated to the version with the editor. You can make changes now; the preview and the changes appear once the website has that version.
          </Notice>
        )
      ) : null}

      <AddressCard websiteUrl={websiteUrl} canEdit={perms.update} />

      <div className="ws-cards">
        <Link href="/admin/website/header-footer" className="ws-card">
          <strong>Header &amp; footer</strong>
          <span className="muted small">Logo, top bar, contact details, footer texts and links</span>
          <span className="ws-card__meta small">{state ? last(state.global) : ''}</span>
        </Link>
        <Link href="/admin/website/menu" className="ws-card">
          <strong>Menu</strong>
          <span className="muted small">Add, rename, reorder and remove menu items and sub-menus</span>
          <span className="ws-card__meta small">{state ? last(state.menus) : ''}</span>
        </Link>
        <Link href="/admin/website/design" className="ws-card">
          <strong>Design</strong>
          <span className="muted small">Colours, fonts and extra CSS for the whole website</span>
          <span className="ws-card__meta small">{state ? last(state.settings) : ''}</span>
        </Link>
        <Link href="/admin/website/downloads" className="ws-card">
          <strong>Downloads</strong>
          <span className="muted small">PDF catalogues, certificates and data sheets for buyers</span>
          <span className="ws-card__meta small">Downloads page of the website</span>
        </Link>
      </div>

      <Card title="Pages made here" actions={perms.create ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(true)}>+ Add a page</button> : null}>
        {!state ? <Spinner /> : !state.custom.length ? (
          <p className="muted">No pages yet. “Add a page” makes a new page from ready-made sections (banner, text, pictures, cards, products, questions, form…).</p>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead><tr><th>Page</th><th>Address</th><th>Status</th><th>Last change</th><th /></tr></thead>
              <tbody>
                {state.custom.map(c => (
                  <tr key={c.id}>
                    <td><Link href={`/admin/website/custom-${c.id}`} className="table__title">{c.title}</Link><span className="table__sub">{c.sections} section{c.sections === 1 ? '' : 's'}</span></td>
                    <td className="mono small">{c.path}</td>
                    <td><Badge status={c.published ? 'published' : 'draft'} /></td>
                    <td className="small muted">{formatDate(c.updatedAt)}{c.updatedByName ? ` · ${c.updatedByName}` : ''}</td>
                    <td className="table__actions">
                      <Link href={`/admin/website/custom-${c.id}`} className="btn btn--ghost btn--sm">Edit</Link>
                      {c.published ? <a href={`${websiteUrl}${c.path}`} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">View ↗</a> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Pages of the website" actions={<input className="input input--sm ws-hub__search" type="search" placeholder="Find a page" value={q} onChange={e => setQ(e.target.value)} aria-label="Find a page" />}>
        {!state ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead><tr><th>Page</th><th>Address</th><th>Changes</th><th>Last change</th><th /></tr></thead>
              <tbody>
                {pages.map(p => (
                  <tr key={p.page}>
                    <td><Link href={`/admin/website/${p.page}`} className="table__title">{p.name}</Link><span className="table__sub">{p.sections} sections · {p.items} items</span></td>
                    <td className="mono small">{p.path}</td>
                    <td>{p.hidden ? <Badge tone="red">Switched off</Badge> : p.changed ? <Badge tone="orange">{p.changed} change{p.changed === 1 ? '' : 's'}</Badge> : <span className="muted small">As built</span>}</td>
                    <td className="small muted">{p.updatedAt ? `${formatDate(p.updatedAt)}${p.updatedByName ? ` · ${p.updatedByName}` : ''}` : '—'}</td>
                    <td className="table__actions">
                      <Link href={`/admin/website/${p.page}`} className="btn btn--primary btn--sm">Edit</Link>
                      <a href={`${websiteUrl}${p.path}`} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">View ↗</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="muted small ws-hub__foot">Pictures you upload are kept in the picture library and can be used again anywhere. Every save keeps the version before it (History in the editor). The website’s own pages are updated for Google automatically when the website rebuilds{state && state.builtAt ? ` (last build: ${formatDate(state.builtAt, true)})` : ''}.</p>
      {adding ? <AddPage onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

function AddPage({ onClose }) {
  const ref = useRef(null);
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [path, setPath] = useState('');
  const [touched, setTouched] = useState(false);
  const [template, setTemplate] = useState('start');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const el = ref.current; if (el && !el.open) el.showModal(); }, []);
  const auto = t => `/${t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)}/`;
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/admin/site/pages', { method: 'POST', body: { title, path: path || auto(title), template } });
      toast.success('Page made. Fill it in, then switch on “Published” in Page settings.');
      router.push(`/admin/website/custom-${r.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <dialog ref={ref} className="dialog" onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby="addpage-title">
      <form onSubmit={submit}>
        <div className="dialog__body">
          <h2 id="addpage-title" className="dialog__title">Add a page</h2>
          {error ? <p className="field__error" role="alert">{error}</p> : null}
          <Field label="Page name" htmlFor="np-title" required>
            <input id="np-title" className="input" autoFocus required value={title} maxLength={120} onChange={e => { setTitle(e.target.value); if (!touched) setPath(e.target.value ? auto(e.target.value) : ''); }} placeholder="e.g. Quality Policy" />
          </Field>
          <Field label="Address" htmlFor="np-path" hint="Small letters, numbers and dashes. It can be changed later.">
            <input id="np-path" className="input mono" value={path} onChange={e => { setTouched(true); setPath(e.target.value); }} placeholder="/quality-policy/" />
          </Field>
          <div className="role-options ws-template">
            <label className={`role-option${template === 'start' ? ' is-active' : ''}`}><input type="radio" name="tpl" checked={template === 'start'} onChange={() => setTemplate('start')} /> <span><strong>Ready to fill in</strong><span className="muted small">A banner, a text section and an enquiry band</span></span></label>
            <label className={`role-option${template === 'empty' ? ' is-active' : ''}`}><input type="radio" name="tpl" checked={template === 'empty'} onChange={() => setTemplate('empty')} /> <span><strong>Empty</strong><span className="muted small">Add the sections yourself</span></span></label>
          </div>
        </div>
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy || !title.trim()}>{busy ? 'Making the page…' : 'Make the page'}</button>
        </div>
      </form>
    </dialog>
  );
}
