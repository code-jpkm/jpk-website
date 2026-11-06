'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import Preview from './Preview';
import History from './History';
import { deepEqual, uid } from './util';

// The main menu: rename, re-link, reorder, indent (sub-menus up to 3 levels), hide and remove items, add new ones.
const MAX_DEPTH = 2; // 0, 1, 2 = three levels (like the products menu)

const clone = v => JSON.parse(JSON.stringify(v || []));

// the menu as a flat list with depths, which is easier to move around in; and back
function flatten(items, depth = 0, out = []) {
  for (const it of items || []) {
    const { children, ...rest } = it;
    out.push({ ...rest, depth });
    if (children && children.length) flatten(children, depth + 1, out);
  }
  return out;
}
function nest(flat) {
  const root = [];
  const stack = [{ depth: -1, children: root }];
  for (const it of flat) {
    const { depth, ...rest } = it;
    const node = { ...rest };
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
    const parent = stack[stack.length - 1];
    (parent.children || (parent.children = [])).push(node);
    stack.push({ depth, children: (node.children = []), node });
  }
  const tidy = list => list.map(n => (n.children && n.children.length ? { ...n, children: tidy(n.children) } : (({ children, ...r }) => r)(n)));
  return tidy(root);
}

export default function MenuEditor({ initial, builtIn, pages, websiteUrl, canEdit }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const start = initial.data && Array.isArray(initial.data.main) && initial.data.main.length ? initial.data.main : builtIn;
  const [flat, setFlat] = useState(() => flatten(clone(start)));
  const [saved, setSaved] = useState(() => flatten(clone(start)));
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt || null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(false);
  const listId = useId();
  const dirty = !deepEqual(flat, saved);
  const main = useMemo(() => nest(flat), [flat]);
  const draft = useMemo(() => ({ menus: { main } }), [main]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (i, patch) => setFlat(f => f.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  // an item moves together with its sub-items
  const block = (f, i) => { let end = i + 1; while (end < f.length && f[end].depth > f[i].depth) end++; return [i, end]; };
  const moveUp = i => setFlat(f => {
    const [s, e] = block(f, i);
    let p = s - 1;
    while (p >= 0 && f[p].depth > f[s].depth) p--;
    if (p < 0 || f[p].depth < f[s].depth) return f;
    return [...f.slice(0, p), ...f.slice(s, e), ...f.slice(p, s), ...f.slice(e)];
  });
  const moveDown = i => setFlat(f => {
    const [s, e] = block(f, i);
    if (e >= f.length || f[e].depth < f[s].depth) return f;
    const [, e2] = block(f, e);
    return [...f.slice(0, s), ...f.slice(e, e2), ...f.slice(s, e), ...f.slice(e2)];
  });
  const indent = i => setFlat(f => {
    if (i === 0 || f[i - 1].depth < f[i].depth || f[i].depth >= MAX_DEPTH) return f;
    const [s, e] = block(f, i);
    if (f.slice(s, e).some(it => it.depth + 1 > MAX_DEPTH)) return f;
    return f.map((it, j) => (j >= s && j < e ? { ...it, depth: it.depth + 1 } : it));
  });
  const outdent = i => setFlat(f => {
    if (f[i].depth === 0) return f;
    const [s, e] = block(f, i);
    return f.map((it, j) => (j >= s && j < e ? { ...it, depth: it.depth - 1 } : it));
  });
  const removeAt = async i => {
    const [s, e] = block(flat, i);
    const n = e - s - 1;
    if (n && !(await confirm({ title: 'Remove this menu item?', message: `“${flat[i].label}” and its ${n} sub-item${n === 1 ? '' : 's'} are removed from the menu. The pages themselves stay.`, confirmLabel: 'Remove' }))) return;
    setFlat(f => [...f.slice(0, s), ...f.slice(e)]);
  };
  const add = (after = flat.length - 1, depth = 0, item = {}) => setFlat(f => {
    const at = after < 0 ? f.length : block(f, after)[1];
    const next = [...f];
    next.splice(at, 0, { id: uid('m'), label: item.label || 'New item', to: item.to || '/', depth, type: 'custom', object: 'custom' });
    return next;
  });

  const save = async (force = false) => {
    setSaving(true);
    try {
      const r = await api('/api/admin/site/part?key=menus', { method: 'PUT', body: { data: { main }, updatedAt, force } });
      const f = flatten(clone(r.data.main && r.data.main.length ? r.data.main : builtIn));
      setFlat(f); setSaved(f); setUpdatedAt(r.updatedAt);
      toast.success('Saved. The menu is live on the website.');
    } catch (err) {
      if (err.status === 409 && (await confirm({ title: 'Someone else saved the menu', message: err.message, confirmLabel: 'Save mine anyway', tone: 'primary' }))) { setSaving(false); return save(true); }
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  const restoreOriginal = async () => {
    if (!(await confirm({ title: 'Go back to the original menu?', message: 'The menu becomes the one the website was built with. Your current menu is kept in History.', confirmLabel: 'Use the original menu' }))) return;
    try {
      await api('/api/admin/site/part?key=menus', { method: 'DELETE' });
      const f = flatten(clone(builtIn));
      setFlat(f); setSaved(f); setUpdatedAt(null);
      toast.success('The original menu is back.');
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="ws-editor">
      <div className="ws-top">
        <Link href="/admin/website" className="ws-top__back">← Website</Link>
        <div className="ws-top__title"><h1>Menu</h1></div>
        <span className="ws-top__status muted small">{dirty ? 'Unsaved changes' : updatedAt ? 'All changes saved' : 'The original menu'}</span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setHistory(true)}>History</button>
        {updatedAt && canEdit ? <button type="button" className="btn btn--ghost btn--sm" onClick={restoreOriginal}>Original menu</button> : null}
        {dirty ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFlat(saved)}>Undo unsaved changes</button> : null}
        <button type="button" className="btn btn--accent" disabled={!canEdit || !dirty || saving} onClick={() => save()}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
      <div className="ws-body">
        <aside className="ws-panel" aria-label="Menu items">
          <p className="ws-hint">Arrows move an item (with its sub-items); → makes it a sub-item of the item above, ← moves it back out. An item with sub-items opens them when pointed at; its own link is used on a click.</p>
          <fieldset className="ws-fieldset" disabled={!canEdit}>
            <ul className="menu-edit">
              {flat.map((it, i) => (
                <li key={it.id} className={`menu-edit__item${it.hidden ? ' is-hidden' : ''}`} style={{ marginLeft: `${it.depth * 22}px` }}>
                  <div className="menu-edit__row">
                    <input className="input input--sm menu-edit__label" value={it.label} onChange={e => set(i, { label: e.target.value })} aria-label="Menu text" maxLength={80} />
                    <span className="menu-edit__tools">
                      <button type="button" className="icon-btn" onClick={() => moveUp(i)} aria-label="Move up" title="Move up">↑</button>
                      <button type="button" className="icon-btn" onClick={() => moveDown(i)} aria-label="Move down" title="Move down">↓</button>
                      <button type="button" className="icon-btn" onClick={() => outdent(i)} disabled={!it.depth} aria-label="Move out of the sub-menu" title="Move out of the sub-menu">←</button>
                      <button type="button" className="icon-btn" onClick={() => indent(i)} disabled={i === 0 || it.depth >= MAX_DEPTH} aria-label="Make a sub-item of the item above" title="Make a sub-item of the item above">→</button>
                      <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeAt(i)} aria-label="Remove" title="Remove">×</button>
                    </span>
                  </div>
                  <div className="menu-edit__row menu-edit__row--sub">
                    <input className="input input--sm mono" list={listId} value={it.to === '#' ? '' : it.to} placeholder="No link (only opens the sub-menu)" onChange={e => set(i, { to: e.target.value.trim() ? e.target.value : '#' })} aria-label="Link address" />
                    <label className="check check--inline"><input type="checkbox" checked={Boolean(it.newTab)} onChange={e => set(i, { newTab: e.target.checked || undefined })} /> New tab</label>
                    <label className="check check--inline"><input type="checkbox" checked={Boolean(it.hidden)} onChange={e => set(i, { hidden: e.target.checked || undefined })} /> Hide</label>
                    <button type="button" className="btn btn--link small" onClick={() => add(i, Math.min(it.depth + 1, MAX_DEPTH))}>+ sub-item</button>
                  </div>
                </li>
              ))}
            </ul>
            <datalist id={listId}>{pages.map(p => <option key={p.path} value={p.path}>{p.name}</option>)}</datalist>
            <div className="menu-edit__add">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => add(flat.length - 1, 0)}>+ Add a menu item</button>
              <select className="select input--sm" value="" onChange={e => { const p = pages.find(x => x.path === e.target.value); if (p) add(flat.length - 1, 0, { label: p.name, to: p.path }); }} aria-label="Add a page to the menu">
                <option value="">+ Add a page…</option>
                {pages.map(p => <option key={p.path} value={p.path}>{p.name} ({p.path})</option>)}
              </select>
            </div>
          </fieldset>
        </aside>
        <section className="ws-preview" aria-label="Preview">
          <Preview websiteUrl={websiteUrl} path="/" draft={draft} />
        </section>
      </div>
      {history ? <History partKey="menus" canRestore={canEdit} onClose={() => setHistory(false)} onRestored={r => { const f = flatten(clone(r.data && r.data.main && r.data.main.length ? r.data.main : builtIn)); setFlat(f); setSaved(f); setUpdatedAt(r.updatedAt); setHistory(false); toast.success('The earlier menu is back and live on the website.'); }} /> : null}
      {confirmDialog}
    </div>
  );
}
