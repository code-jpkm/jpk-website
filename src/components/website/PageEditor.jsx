'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { Badge, Field, Icon } from '@/components/ui';
import SeoFields from '@/components/fields/SeoFields';
import Preview from './Preview';
import { TextControl, RichControl, LinkControl, ImageControl, GalleryControl, NumberControl, BuilderForm } from './controls';
import { deepEqual, fieldLabel, plainText, htmlToText, uid, thumbOf } from './util';
import History from './History';

// The website editor for one page (mode "page"), the header and footer ("global") or a page made in the admin
// ("custom"): sections on the left (reorder, hide, add, edit), the live page on the right.

const EMPTY = {};
const ordered = (saved, refs) => {
  if (!Array.isArray(saved) || !saved.length) return refs.map(ref => ({ ref }));
  const items = saved.filter(it => it && (it.ref ? refs.includes(it.ref) : it.type));
  for (const ref of refs) if (!items.some(it => it.ref === ref)) items.push({ ref });
  return items;
};
const isBuiltOrder = (list, refs) => list.length === refs.length && list.every((it, i) => it.ref === refs[i] && !it.hidden);

function cleanData(mode, d) {
  if (mode === 'custom') return { title: d.title || '', path: d.path || '', published: Boolean(d.published), sections: d.sections || [], seo: d.seo || {} };
  if (mode === 'global') return { content: d.content || {} };
  const out = { content: d.content || {}, seo: d.seo || {} };
  if (Array.isArray(d.sections)) out.sections = d.sections;
  if (d.hidden) out.hidden = true;
  return out;
}

export default function PageEditor({ mode, partKey, schemaPage, schemaGlobal, types, websiteUrl, pages, initial, perms, customId }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [data, setData] = useState(() => cleanData(mode, initial.data || EMPTY));
  const [saved, setSaved] = useState(() => cleanData(mode, initial.data || EMPTY));
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt || null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState({ name: 'sections' });
  const [focus, setFocus] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(null); // index to add a section after
  const [history, setHistory] = useState(false);
  const [notice, setNotice] = useState('');
  const panel = useRef(null);
  const dirty = !deepEqual(data, saved);
  const canEdit = perms.update;

  const fields = mode === 'global' ? schemaGlobal.fields : mode === 'page' ? schemaPage.fields : EMPTY;
  const builtSections = mode === 'global' ? schemaGlobal.sections : mode === 'page' ? schemaPage.sections : [];
  const refs = useMemo(() => builtSections.map(s => s.id), [builtSections]);
  const labels = useMemo(() => Object.fromEntries(builtSections.map(s => [s.id, s])), [builtSections]);
  const list = mode === 'custom' ? data.sections : mode === 'page' ? ordered(data.sections, refs) : builtSections.map(s => ({ ref: s.id }));
  const content = data.content || EMPTY;
  const path = mode === 'page' ? schemaPage.path : mode === 'global' ? '/' : '/cms-preview/';

  // warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // what the page in the preview shows (unsaved)
  const draft = useMemo(() => {
    if (mode === 'global') return { page: '__header_footer__', global: content };
    if (mode === 'custom') return { page: `custom:${customId}`, customPage: { id: customId, title: data.title, path: data.path || '/cms-preview/', published: true, sections: data.sections, seo: data.seo } };
    return { page: schemaPage.page, content, sections: list, seo: data.seo, hidden: Boolean(data.hidden) };
  }, [mode, data, content, list, customId, schemaPage]);

  // ---- changes ----
  const setContent = (key, value) => setData(d => {
    const c = { ...(d.content || {}) };
    const f = fields[key];
    if (value === undefined || value === null || (f && typeof value === 'string' && value === f.default)) delete c[key];
    else c[key] = value;
    return { ...d, content: c };
  });
  const setList = next => setData(d => {
    if (mode === 'custom') return { ...d, sections: next };
    const out = { ...d };
    if (isBuiltOrder(next, refs)) delete out.sections; else out.sections = next;
    return out;
  });
  const move = (i, delta) => { const l = [...list]; const [x] = l.splice(i, 1); l.splice(i + delta, 0, x); setList(l); };
  const toggleHidden = i => setList(list.map((it, j) => (j === i ? { ...it, hidden: !it.hidden || undefined } : it)));
  const sectionId = it => it.ref || it.id;
  const addSection = (type, at) => {
    const def = types[type];
    const item = { id: uid('s'), type, data: JSON.parse(JSON.stringify(def.defaults || {})) };
    const l = [...list];
    l.splice(at, 0, item);
    setList(l);
    setAdding(null);
    setView({ name: 'section', id: item.id });
    setTimeout(() => setFocus({ section: item.id, n: Date.now() }), 400);
  };
  const duplicate = i => { const l = [...list]; const copy = { ...JSON.parse(JSON.stringify(l[i])), id: uid('s') }; l.splice(i + 1, 0, copy); setList(l); };
  const remove = async i => {
    const it = list[i];
    if (!(await confirm({ title: 'Delete this section?', message: `“${sectionLabel(it)}” is removed from the page when you save. You can bring it back with History.`, confirmLabel: 'Delete section' }))) return;
    setList(list.filter((_, j) => j !== i));
    setView({ name: 'sections' });
  };
  const setBuilder = (id, d) => setList(list.map(it => (it.id === id ? { ...it, data: d } : it)));

  // the section's name: its first heading as it is now (changed or not), else the name from the website
  const firstHeading = useMemo(() => {
    const out = {};
    for (const [k, f] of Object.entries(fields)) if (f.kind === 'text' && /^h[1-4]$/.test(f.tag) && f.section && !out[f.section]) out[f.section] = k;
    return out;
  }, [fields]);
  function sectionLabel(it) {
    if (it.ref) {
      const k = firstHeading[it.ref];
      if (k && content[k] !== undefined && plainText(content[k], 70)) return plainText(content[k], 70);
      return (labels[it.ref] && labels[it.ref].label) || it.ref;
    }
    const def = types[it.type];
    const h = it.data && (it.data.heading || it.data.title);
    return `${def ? def.label : it.type}${h ? `: ${h}` : ''}`;
  }
  const changedIn = useCallback(sec => Object.keys(content).filter(k => fields[k] && fields[k].section === sec).length, [content, fields]);

  // ---- save ----
  const save = async (force = false) => {
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      const r = await api(`/api/admin/site/part?key=${encodeURIComponent(partKey)}`, { method: 'PUT', body: { data, updatedAt, force } });
      const next = cleanData(mode, r.data || EMPTY);
      setSaved(next);
      setData(next);
      setUpdatedAt(r.updatedAt);
      toast.success(mode === 'custom' && !next.published ? 'Saved. The page is not published yet.' : 'Saved. The change is live on the website.');
    } catch (err) {
      if (err.status === 409 && (await confirm({ title: 'Someone else saved this page', message: err.message, confirmLabel: 'Save mine anyway', tone: 'primary' }))) { setSaving(false); return save(true); }
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    const onKey = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- clicks in the preview ----
  const onSelect = useCallback(({ key, section }) => {
    if (key && key.includes('/')) {
      const [sid, name] = key.split('/');
      setView({ name: 'section', id: sid });
      setHighlight({ field: name.split('.')[0], at: Date.now() });
      return;
    }
    if (key && fields[key]) {
      setView({ name: 'section', id: fields[key].section || section });
      setHighlight({ key: fields[key].kind === 'link' && fields[key].of ? fields[key].of : key, at: Date.now() });
      setNotice('');
      return;
    }
    if (key && !fields[key]) {
      if (section && productGroupsOf(schemaPage, section).length) {
        setView({ name: 'section', id: section });
        setNotice('This product is changed in Products: open it from the list of products of this section.');
        return;
      }
      setNotice(mode === 'global' ? 'This is part of the page, not of the header or footer: edit it on its page.' : 'This is part of the header or footer, which are the same on every page.');
      return;
    }
    if (section) { setView({ name: 'section', id: section }); setNotice(''); }
  }, [fields, mode, schemaPage]);

  // scroll the panel to the highlighted box
  useEffect(() => {
    if (!highlight || !panel.current) return;
    const t = setTimeout(() => {
      const el = panel.current.querySelector(highlight.key ? `[data-key="${CSS.escape(highlight.key)}"]` : `[data-field="${CSS.escape(highlight.field)}"]`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('is-flash'); setTimeout(() => el.classList.remove('is-flash'), 1600); }
    }, 80);
    return () => clearTimeout(t);
  }, [highlight, view]);

  const open = it => { setView({ name: 'section', id: sectionId(it) }); setFocus({ section: sectionId(it), n: Date.now() }); };
  const current = view.name === 'section' ? list.find(it => sectionId(it) === view.id) : null;
  const currentIndex = current ? list.indexOf(current) : -1;

  // search across the page's texts
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2 || mode === 'custom') return [];
    const out = [];
    for (const [k, f] of Object.entries(fields)) {
      if (f.kind !== 'text' && f.kind !== 'rich') continue;
      const text = htmlToText(content[k] !== undefined ? content[k] : f.default || '');
      if (text.toLowerCase().includes(needle)) out.push({ k, f, text });
      if (out.length > 40) break;
    }
    return out;
  }, [q, fields, content, mode]);

  const title = mode === 'global' ? 'Header & footer' : mode === 'page' ? schemaPage.name : data.title || 'New page';

  return (
    <div className="ws-editor">
      <div className="ws-top">
        <Link href="/admin/website" className="ws-top__back">← Website</Link>
        <div className="ws-top__title">
          <h1>{title}</h1>
          {mode !== 'global' ? <span className="ws-top__path mono">{mode === 'custom' ? data.path || '(no address yet)' : schemaPage.path}</span> : null}
          {mode === 'page' && data.hidden ? <Badge tone="red">Switched off</Badge> : null}
          {mode === 'custom' ? <Badge status={data.published ? 'published' : 'draft'} /> : null}
        </div>
        <span className="ws-top__status muted small" aria-live="polite">{dirty ? 'Unsaved changes' : updatedAt ? 'All changes saved' : 'No changes yet'}</span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setHistory(true)}>History</button>
        {dirty ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => setData(saved)}>Undo unsaved changes</button> : null}
        <button type="button" className="btn btn--accent" onClick={() => save()} disabled={!canEdit || !dirty || saving} title="Ctrl+S">{saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="ws-body">
        <aside className="ws-panel" ref={panel} aria-label="Page content">
          {!canEdit ? <p className="ws-readonly">You can look but not change: ask an administrator for the “Edit” right of the website editor.</p> : null}
          {notice ? <p className="ws-notice">{notice} {mode === 'page' ? <Link href="/admin/website/header-footer">Edit the header & footer →</Link> : null}<button type="button" className="btn btn--link small" onClick={() => setNotice('')}>OK</button></p> : null}

          {view.name === 'sections' ? (
            <>
              {mode !== 'global' ? (
                <button type="button" className="ws-settings-row" onClick={() => setView({ name: 'settings' })}>
                  <span><strong>Page settings</strong><span className="muted small">{mode === 'custom' ? 'Name, address, published, Google title and description' : 'Google title and description, page on or off'}</span></span>
                  <span aria-hidden="true">›</span>
                </button>
              ) : null}
              {mode !== 'custom' ? (
                <div className="ws-search">
                  <input className="input input--sm" type="search" placeholder="Find a text on this page…" value={q} onChange={e => setQ(e.target.value)} aria-label="Find a text" />
                </div>
              ) : null}
              {q.trim().length >= 2 ? (
                <div className="ws-results">
                  {!results.length ? <p className="muted small">No text on this page contains “{q}”.</p> : null}
                  {results.map(r => (
                    <button key={r.k} type="button" className="ws-result" onClick={() => { setView({ name: 'section', id: r.f.section }); setHighlight({ key: r.k, at: Date.now() }); setFocus({ key: r.k, section: r.f.section, n: Date.now() }); setQ(''); }}>
                      <span className="ws-result__where">{fieldLabel(r.k, r.f)} · {labels[r.f.section] ? labels[r.f.section].label : r.f.section}</span>
                      <span className="ws-result__text">{plainText(r.text, 110)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <p className="ws-hint">{mode === 'global' ? 'Click a part of the header or footer in the preview, or open it here.' : 'Click anything on the page in the preview to change it, or open a section here.'}</p>
                  <ol className="ws-sections">
                    {list.map((it, i) => {
                      const id = sectionId(it);
                      const n = it.ref ? changedIn(it.ref) : 0;
                      const note = it.ref && labels[it.ref] ? labels[it.ref].note : '';
                      return (
                        <li key={id} className={`ws-sec${it.hidden ? ' is-hidden' : ''}${it.ref ? '' : ' is-added'}`}>
                          <button type="button" className="ws-sec__main" onClick={() => open(it)}>
                            <span className="ws-sec__label">{sectionLabel(it)}</span>
                            <span className="ws-sec__meta">
                              {it.ref ? null : <span className="chip">Added</span>}
                              {note ? <span className="muted small">{note}</span> : null}
                              {n ? <span className="chip chip--orange">{n} changed</span> : null}
                              {it.hidden ? <span className="chip chip--grey">Hidden</span> : null}
                            </span>
                          </button>
                          {mode !== 'global' && canEdit ? (
                            <span className="ws-sec__tools">
                              <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">↑</button>
                              <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Move down" title="Move down">↓</button>
                              <button type="button" className="icon-btn" onClick={() => toggleHidden(i)} aria-label={it.hidden ? 'Show this section' : 'Hide this section'} title={it.hidden ? 'Hidden: click to show this section' : 'Hide this section'}><Icon name={it.hidden ? 'eyeoff' : 'eye'} size={16} /></button>
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                  {mode !== 'global' && canEdit ? <button type="button" className="btn btn--ghost btn--block" onClick={() => setAdding(list.length)}>+ Add a section</button> : null}
                  {mode === 'page' && Array.isArray(data.sections) && canEdit ? (
                    <p className="ws-reset"><button type="button" className="btn btn--link small" onClick={async () => {
                      const added = list.filter(it => !it.ref).length;
                      if (added && !(await confirm({ title: 'Go back to the original sections?', message: `The original order is restored, hidden sections come back and the ${added} added section${added === 1 ? '' : 's'} ${added === 1 ? 'is' : 'are'} removed.`, confirmLabel: 'Restore the original sections' }))) return;
                      setData(d => { const o = { ...d }; delete o.sections; return o; });
                    }}>Original order and sections</button></p>
                  ) : null}
                </>
              )}
            </>
          ) : null}

          {view.name === 'section' && current ? (
            <div className="ws-section">
              <div className="ws-section__head">
                <button type="button" className="btn btn--link" onClick={() => setView({ name: 'sections' })}>← All sections</button>
                {mode !== 'global' && canEdit ? (
                  <span className="ws-section__tools">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggleHidden(currentIndex)}>{current.hidden ? 'Show section' : 'Hide section'}</button>
                    {!current.ref ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => duplicate(currentIndex)}>Duplicate</button> : null}
                    {!current.ref ? <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={() => remove(currentIndex)}>Delete</button> : null}
                  </span>
                ) : null}
              </div>
              <h2 className="ws-section__title">{sectionLabel(current)}</h2>
              {current.hidden ? <p className="ws-hint">This section is hidden: visitors don’t see it.</p> : null}
              <fieldset className="ws-fieldset" disabled={!canEdit}>
                {current.ref && productGroupsOf(schemaPage, current.ref).length ? <ProductsNote groups={productGroupsOf(schemaPage, current.ref)} canOpen={perms.products !== false} /> : null}
                {current.ref ? (
                  <BuiltInFields sec={current.ref} fields={fields} content={content} setContent={setContent} websiteUrl={websiteUrl} pages={pages} onFocus={k => setFocus({ key: k, section: current.ref, n: Date.now() })} />
                ) : types[current.type] ? (
                  <BuilderForm def={types[current.type]} data={current.data} onChange={d => setBuilder(current.id, d)} ctx={{ websiteUrl, pages }} />
                ) : <p className="muted">This kind of section (“{current.type}”) is not known to the website any more. You can delete it.</p>}
              </fieldset>
              {mode !== 'global' && canEdit ? <button type="button" className="btn btn--ghost btn--block ws-add-after" onClick={() => setAdding(currentIndex + 1)}>+ Add a section after this one</button> : null}
            </div>
          ) : null}
          {view.name === 'section' && !current ? (
            <div className="ws-section">
              <button type="button" className="btn btn--link" onClick={() => setView({ name: 'sections' })}>← All sections</button>
              <p className="muted">This section is no longer on the page.</p>
            </div>
          ) : null}

          {view.name === 'settings' ? (
            <div className="ws-section">
              <div className="ws-section__head"><button type="button" className="btn btn--link" onClick={() => setView({ name: 'sections' })}>← All sections</button></div>
              <h2 className="ws-section__title">Page settings</h2>
              <fieldset className="ws-fieldset" disabled={!canEdit}>
                {mode === 'custom' ? (
                  <>
                    <Field label="Page name" htmlFor="pg-title" required hint="Shown in the browser tab and in Google, and as the page’s name in the admin.">
                      <input id="pg-title" className="input" value={data.title} onChange={e => setData(d => ({ ...d, title: e.target.value }))} maxLength={120} />
                    </Field>
                    <Field label="Address" htmlFor="pg-path" hint={`The page is at ${websiteUrl}${data.path || '/…/'} (small letters, numbers and dashes).`}>
                      <input id="pg-path" className="input mono" value={data.path} onChange={e => setData(d => ({ ...d, path: e.target.value }))} placeholder="/quality-policy/" />
                    </Field>
                    <label className="check ws-check"><input type="checkbox" checked={data.published} onChange={e => setData(d => ({ ...d, published: e.target.checked }))} /> <span><strong>Published</strong> — visitors can open the page. Add it to the menu under Website → Menu.</span></label>
                  </>
                ) : schemaPage.path !== '/' ? (
                  <label className="check ws-check"><input type="checkbox" checked={!data.hidden} onChange={e => setData(d => { const o = { ...d }; if (e.target.checked) delete o.hidden; else o.hidden = true; return o; })} /> <span><strong>Show this page on the website</strong> — when switched off, the address shows “page not found”. Remove it from the menu too.</span></label>
                ) : null}
                <h3 className="ws-sub">Google (search engines)</h3>
                <SeoFields
                  title={(data.seo && data.seo.title) || ''}
                  description={(data.seo && data.seo.description) || ''}
                  fallbackTitle={mode === 'page' ? schemaPage.seo.title : `${data.title || 'Page'} | JPK Metallics`}
                  fallbackDescription={mode === 'page' ? schemaPage.seo.description : ''}
                  url={`${websiteUrl.replace(/^https?:\/\//, '')}${mode === 'page' ? schemaPage.path : data.path || '/'}`}
                  onChange={(k, v) => setData(d => ({ ...d, seo: { ...(d.seo || {}), [k === 'seoTitle' ? 'title' : 'description']: v } }))}
                />
                <label className="check ws-check"><input type="checkbox" checked={Boolean(data.seo && data.seo.noindex)} onChange={e => setData(d => ({ ...d, seo: { ...(d.seo || {}), noindex: e.target.checked || undefined } }))} /> <span>Ask Google not to show this page in search results</span></label>
              </fieldset>
              {mode === 'custom' && perms.delete ? (
                <div className="danger-zone ws-danger">
                  <p><strong>Delete this page</strong><br /><span className="muted small">The page and its sections are removed from the website.</span></p>
                  <button type="button" className="btn btn--danger btn--sm" onClick={async () => {
                    if (!(await confirm({ title: 'Delete this page?', message: `“${data.title}” is removed from the website. Remember to remove it from the menu.`, confirmLabel: 'Delete page' }))) return;
                    try { await api(`/api/admin/site/part?key=${encodeURIComponent(partKey)}`, { method: 'DELETE' }); setSaved(data); toast.success('The page was deleted.'); window.location.assign('/admin/website'); } catch (err) { toast.error(err.message); }
                  }}>Delete page</button>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>

        <section className="ws-preview" aria-label="Preview">
          <Preview websiteUrl={websiteUrl} path={path} draft={draft} focus={focus} onSelect={onSelect} />
        </section>
      </div>

      {adding !== null ? <AddSection types={types} onClose={() => setAdding(null)} onAdd={type => addSection(type, adding)} /> : null}
      {history ? <History partKey={partKey} onClose={() => setHistory(false)} canRestore={canEdit} onRestored={r => { const next = cleanData(mode, r.data || EMPTY); setSaved(next); setData(next); setUpdatedAt(r.updatedAt); setHistory(false); toast.success('The earlier version is back and live on the website.'); }} /> : null}
      {confirmDialog}
    </div>
  );
}

// the groups of product cards in a section of a product page (site-schema.json pages[].products)
function productGroupsOf(schemaPage, section) {
  return ((schemaPage && schemaPage.products) || []).filter(g => g.section === section).map(g => g.group);
}

// a product page's cards come from Products: the products of this section, each with a link to change it
function ProductsNote({ groups, canOpen }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!canOpen) return undefined;
    let live = true;
    api(`/api/admin/products/on-page?groups=${groups.join(',')}`).then(r => { if (live) setData(r.groups || {}); }).catch(err => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [groups.join(','), canOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="ws-box ws-products" data-testid="products-note">
      <div className="ws-box__head"><span className="ws-box__label">Products</span></div>
      <p className="small" style={{ margin: '0 0 10px' }}>The product cards of this section (name, photo, load class, text) come from <strong>Products</strong>. Change, add or remove a product there and the page follows.</p>
      {!canOpen ? <p className="muted small">Your account cannot open Products.</p> : error ? <p className="muted small">{error}</p> : !data ? <p className="muted small">Loading the products…</p> : (
        groups.map(id => {
          const g = data[id];
          if (!g) return null;
          return (
            <div key={id} className="ws-products__group">
              {groups.length > 1 ? <p className="ws-products__label small"><strong>{g.label}</strong></p> : null}
              {g.items.length ? (
                <ul className="ws-products__list">
                  {g.items.map(p => (
                    <li key={p._id}>
                      {p.image ? <img src={thumbOf(p.image, 120)} alt="" loading="lazy" /> : <span className="ws-products__noimg" />}
                      <span className="ws-products__name">{p.name}</span>
                      <Link href={`/admin/products/${p._id}`} className="btn btn--ghost btn--sm">Edit</Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted small">No products are shown here at the moment.</p>}
            </div>
          );
        })
      )}
      {canOpen ? <Link href="/admin/products/new" className="btn btn--ghost btn--sm" style={{ marginTop: 8 }}>+ New product</Link> : null}
    </div>
  );
}

// the texts, links, pictures… of one of the page's own sections, in the order they appear on the page
function BuiltInFields({ sec, fields, content, setContent, websiteUrl, pages, onFocus }) {
  const keys = Object.keys(fields).filter(k => fields[k].section === sec && !(fields[k].kind === 'link' && fields[k].of && fields[fields[k].of]));
  if (!keys.length) return <p className="muted">There is nothing in this section that can be changed here (for example a list of posts that comes from JPK Updates, or a form).</p>;
  return keys.map(k => {
    const f = fields[k];
    const changed = content[k] !== undefined || (f.link && content[f.link] !== undefined);
    const undo = () => { setContent(k, undefined); if (f.link) setContent(f.link, undefined); };
    return (
      <div key={k} className={`ws-box${changed ? ' is-changed' : ''}`} data-key={k} onFocusCapture={() => onFocus(k)}>
        <div className="ws-box__head">
          <span className="ws-box__label">{fieldLabel(k, f)}{f.kind === 'link' && f.text ? <span className="muted">: {plainText(f.text, 40)}</span> : null}</span>
          {changed ? <><span className="chip chip--orange">Changed</span><button type="button" className="btn btn--link small" onClick={undo}>Undo</button></> : null}
        </div>
        {f.kind === 'text' ? <TextControl value={content[k]} builtIn={f.default} onChange={v => setContent(k, v)} single={/^h[1-6]$/.test(f.tag)} /> : null}
        {f.kind === 'text' && f.link && fields[f.link] ? (
          <div className="ws-box__link"><span className="muted small">Link</span><LinkControl value={content[f.link]} builtIn={{ href: fields[f.link].href, newTab: fields[f.link].newTab }} onChange={v => setContent(f.link, v && v.href ? v : undefined)} pages={pages} /></div>
        ) : null}
        {f.kind === 'rich' ? <RichControl value={content[k]} builtIn={f.default} onChange={v => setContent(k, v)} /> : null}
        {f.kind === 'link' ? <LinkControl value={content[k]} builtIn={{ href: f.href, newTab: f.newTab }} onChange={v => setContent(k, v && v.href ? v : undefined)} pages={pages} /> : null}
        {f.kind === 'image' || f.kind === 'bg' ? <ImageControl value={content[k]} builtIn={{ preview: f.preview, thumb: f.thumb, alt: f.alt }} onChange={v => setContent(k, v)} websiteUrl={websiteUrl} /> : null}
        {f.kind === 'number' ? <NumberControl value={content[k]} builtIn={f.default} onChange={v => setContent(k, v)} /> : null}
        {f.kind === 'gallery' ? <GalleryControl value={content[k]} builtIn={f.items} onChange={v => setContent(k, v)} websiteUrl={websiteUrl} /> : null}
        {f.kind === 'text' && content[k] !== undefined && f.default ? <p className="ws-box__was muted small">Was: {plainText(f.default, 140)}</p> : null}
      </div>
    );
  });
}

function AddSection({ types, onClose, onAdd }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (el && !el.open) el.showModal(); }, []);
  return (
    <dialog ref={ref} className="dialog dialog--wide" onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby="add-title">
      <div className="dialog__body">
        <h2 id="add-title" className="dialog__title">Add a section</h2>
        <p className="dialog__text">Choose what the new section shows. You can change everything in it afterwards.</p>
        <div className="ws-types">
          {Object.values(types).map(t => (
            <button key={t.type} type="button" className="ws-type" onClick={() => onAdd(t.type)}>
              <strong>{t.label}</strong>
              <span className="muted small">{t.description}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="dialog__actions"><button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button></div>
    </dialog>
  );
}
