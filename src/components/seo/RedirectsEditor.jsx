'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { Card, PageHeader, Icon } from '@/components/ui';
import SeoNav from './SeoNav';

const rowsOf = d => ((d && d.redirects) || []).map(r => ({ from: r.from, to: r.to, code: r.code === 302 ? 302 : 301 }));

// Website › SEO › Redirects: send an old address (a removed page, a printed link, an old campaign) to a page that
// exists, so visitors and Google don't land on "page not found".
export default function RedirectsEditor({ initial, builtIn, websiteUrl, pages, canEdit }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [data, setData] = useState(initial.data || {});
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt || null);
  const [rows, setRows] = useState(() => rowsOf(initial.data));
  const [saving, setSaving] = useState(false);
  const [showBuilt, setShowBuilt] = useState(false);
  const dirty = JSON.stringify(rows) !== JSON.stringify(rowsOf(data));
  const set = (i, k, v) => setRows(list => list.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const domain = websiteUrl.replace(/^https?:\/\//, '');

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async (force = false) => {
    setSaving(true);
    try {
      const list = rows.filter(r => r.from.trim() || r.to.trim());
      const r = await api('/api/admin/site/part?key=seo', { method: 'PUT', body: { data: { ...data, redirects: list }, updatedAt, force } });
      setData(r.data || {}); setUpdatedAt(r.updatedAt); setRows(rowsOf(r.data));
      toast.success('Saved. The redirects work at once; the website’s host gets them at the next website build.');
    } catch (err) {
      if (err.status === 409 && (await confirm({ title: 'Someone else saved the SEO settings', message: err.message, confirmLabel: 'Save mine anyway', tone: 'primary' }))) { setSaving(false); return save(true); }
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const pageList = useMemo(() => pages.map(p => p.path), [pages]);
  return (
    <>
      <PageHeader title="Redirects" description={`Send an old address of ${domain} to another page. Use it when a page was removed or its address changed, so links and Google results keep working.`}
        actions={canEdit ? <>{dirty ? <button type="button" className="btn btn--ghost" onClick={() => setRows(rowsOf(data))}>Undo changes</button> : null}<button type="button" className="btn btn--accent" disabled={!dirty || saving} onClick={() => save()}>{saving ? 'Saving…' : 'Save'}</button></> : null} />
      <SeoNav />
      <fieldset className="plain" disabled={!canEdit || saving}>
        <Card title="Your redirects" pad={false}>
          <datalist id="site-pages">{pageList.map(p => <option key={p} value={p} />)}</datalist>
          {rows.length ? (
            <table className="table redirects" data-testid="redirects">
              <thead><tr><th>Old address</th><th aria-hidden="true" /><th>Goes to</th><th className="hide-sm">Kind</th><th><span className="sr-only">Remove</span></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><input className="input input--sm" value={r.from} onChange={e => set(i, 'from', e.target.value)} placeholder="/old-page/" aria-label="Old address" /></td>
                    <td className="muted" aria-hidden="true">→</td>
                    <td><input className="input input--sm" value={r.to} onChange={e => set(i, 'to', e.target.value)} placeholder="/contact-us/ or https://…" list="site-pages" aria-label="Goes to" /></td>
                    <td className="hide-sm">
                      <select className="select select--sm" value={r.code} onChange={e => set(i, 'code', Number(e.target.value))} aria-label="Kind">
                        <option value={301}>Moved for good (301)</option>
                        <option value={302}>For now (302)</option>
                      </select>
                    </td>
                    <td><button type="button" className="icon-btn icon-btn--danger" onClick={() => setRows(list => list.filter((_, j) => j !== i))} aria-label={`Remove the redirect from ${r.from || 'this address'}`}><Icon name="trash" size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted" style={{ padding: '18px 20px 6px' }}>No redirects of your own yet.</p>}
          <div style={{ padding: '12px 20px 18px' }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRows(list => [...list, { from: '', to: '', code: 301 }])}>+ Add a redirect</button>
          </div>
        </Card>
      </fieldset>
      <Card title={`Built into the website (${builtIn.length})`} actions={<button type="button" className="btn btn--link btn--sm" onClick={() => setShowBuilt(v => !v)}>{showBuilt ? 'Hide' : 'Show'}</button>}>
        <p className="muted small" style={{ marginTop: -4 }}>The old WordPress addresses, already sent to the new pages.</p>
        {showBuilt ? (
          <table className="table table--compact">
            <tbody>{builtIn.map(r => <tr key={r.from}><td className="small mono">{r.from}</td><td className="muted">→</td><td className="small mono">{r.to}</td></tr>)}</tbody>
          </table>
        ) : null}
      </Card>
      {confirmDialog}
    </>
  );
}
