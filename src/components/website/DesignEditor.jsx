'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { Field } from '@/components/ui';
import Preview from './Preview';
import History from './History';
import { deepEqual } from './util';

// Design of the whole website: the brand colours, the two fonts and extra CSS, with the live website beside them.
const blank = d => ({ theme: { ...((d && d.theme) || {}) }, customCss: (d && d.customCss) || '' });

export default function DesignEditor({ initial, theme, pages, websiteUrl, canEdit }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [data, setData] = useState(() => blank(initial.data));
  const [saved, setSaved] = useState(() => blank(initial.data));
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt || null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(false);
  const [path, setPath] = useState('/');
  const dirty = !deepEqual(data, saved);
  const draft = useMemo(() => ({ settings: data }), [data]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setTheme = (k, v) => setData(d => { const t = { ...d.theme }; if (v === undefined) delete t[k]; else t[k] = v; return { ...d, theme: t }; });
  const save = async (force = false) => {
    setSaving(true);
    try {
      const r = await api('/api/admin/site/part?key=settings', { method: 'PUT', body: { data, updatedAt, force } });
      const next = blank(r.data);
      setData(next); setSaved(next); setUpdatedAt(r.updatedAt);
      toast.success('Saved. The design is live on the website.');
    } catch (err) {
      if (err.status === 409 && (await confirm({ title: 'Someone else saved the design', message: err.message, confirmLabel: 'Save mine anyway', tone: 'primary' }))) { setSaving(false); return save(true); }
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ws-editor">
      <div className="ws-top">
        <Link href="/admin/website" className="ws-top__back">← Website</Link>
        <div className="ws-top__title"><h1>Design</h1></div>
        <span className="ws-top__status muted small">{dirty ? 'Unsaved changes' : updatedAt ? 'All changes saved' : 'The original design'}</span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setHistory(true)}>History</button>
        {dirty ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => setData(saved)}>Undo unsaved changes</button> : null}
        <button type="button" className="btn btn--accent" disabled={!canEdit || !dirty || saving} onClick={() => save()}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="ws-body">
        <aside className="ws-panel" aria-label="Design settings">
          <fieldset className="ws-fieldset" disabled={!canEdit}>
            <h2 className="ws-sub">Colours</h2>
            <p className="ws-hint">The colours used all over the website. Changing one changes every place it is used.</p>
            {theme.colors.map(c => {
              const v = data.theme[c.key] || c.default;
              return (
                <div key={c.key} className={`ws-box${data.theme[c.key] ? ' is-changed' : ''}`}>
                  <div className="ws-box__head">
                    <span className="ws-box__label">{c.label}</span>
                    {data.theme[c.key] ? <button type="button" className="btn btn--link small" onClick={() => setTheme(c.key, undefined)}>Original ({c.default})</button> : null}
                  </div>
                  <div className="color-row">
                    <input type="color" className="color-input" value={v.length === 7 ? v : c.default} onChange={e => setTheme(c.key, e.target.value.toUpperCase() === c.default.toUpperCase() ? undefined : e.target.value.toUpperCase())} aria-label={`${c.label} colour`} />
                    <input className="input input--sm mono color-row__hex" value={v} maxLength={7} onChange={e => { const x = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(x)) setTheme(c.key, x.toUpperCase() === c.default.toUpperCase() ? undefined : x.toUpperCase()); }} aria-label={`${c.label} colour code`} />
                    <span className="muted small">{c.hint}</span>
                  </div>
                </div>
              );
            })}
            <h2 className="ws-sub">Fonts</h2>
            {theme.fonts.map(f => (
              <Field key={f.key} label={f.label} htmlFor={`font-${f.key}`} hint={data.theme[f.key] ? `Original: ${f.default}` : undefined}>
                <select id={`font-${f.key}`} className="select" value={data.theme[f.key] || f.default} onChange={e => setTheme(f.key, e.target.value === f.default ? undefined : e.target.value)}>
                  {theme.fontChoices.map(n => <option key={n} value={n}>{n}{n === f.default ? ' (original)' : ''}</option>)}
                </select>
              </Field>
            ))}
            <h2 className="ws-sub">Extra CSS</h2>
            <p className="ws-hint">For experts: CSS rules added after all others on every page (for example <span className="mono">.elementor-heading-title {'{'} letter-spacing: .5px; {'}'}</span>).</p>
            <textarea className="textarea mono ws-css" rows={12} value={data.customCss} spellCheck={false} onChange={e => setData(d => ({ ...d, customCss: e.target.value }))} aria-label="Extra CSS" />
          </fieldset>
        </aside>
        <section className="ws-preview" aria-label="Preview">
          <Preview websiteUrl={websiteUrl} path={path} draft={draft} toolbar={
            <select className="select input--sm preview__page" value={path} onChange={e => setPath(e.target.value)} aria-label="Page to show">
              {pages.map(p => <option key={p.path} value={p.path}>{p.name}</option>)}
            </select>
          } />
        </section>
      </div>
      {history ? <History partKey="settings" canRestore={canEdit} onClose={() => setHistory(false)} onRestored={r => { const next = blank(r.data); setData(next); setSaved(next); setUpdatedAt(r.updatedAt); setHistory(false); toast.success('The earlier design is back and live on the website.'); }} /> : null}
      {confirmDialog}
    </div>
  );
}
