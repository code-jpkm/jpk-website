'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { Card, PageHeader, Notice, EmptyState } from '@/components/ui';
import SeoNav, { linksHref } from './SeoNav';

const TYPE = { internal: 'Internal', external: 'External', contact: 'Email / phone', anchor: 'On this page' };

function address(l) {
  if (l.type === 'internal') {
    if (l.status === 'ok' || l.status === 'hidden') return <>{l.page.name} <span className="muted">{l.path}</span></>;
    return <span className="mono">{l.path}</span>;
  }
  if (l.type === 'contact') return <span className="mono">{l.href.replace(/^(mailto|tel):/i, '')}</span>;
  if (l.type === 'anchor') return <span className="mono">{l.href || '(no address yet)'}</span>;
  return <a href={l.href} target="_blank" rel="noopener noreferrer" className="mono">{l.href.length > 70 ? `${l.href.slice(0, 68)}…` : l.href}</a>;
}

// the address, words and options of a link (a change, or a new link for chosen words)
function LinkDialog({ title, link, words, targets, onSave, onClose }) {
  const ref = useRef(null);
  const start = link ? (link.type === 'internal' && targets.some(t => t.path === link.path) && !/^https?:/i.test(link.href) ? 'page' : 'address') : 'page';
  const [mode, setMode] = useState(start);
  const [page, setPage] = useState(link && start === 'page' ? link.path : '');
  const [href, setHref] = useState(link && start === 'address' ? link.href : '');
  const [text, setText] = useState(link ? link.text : '');
  const [newTab, setNewTab] = useState(link ? Boolean(link.newTab) : false);
  const [nofollow, setNofollow] = useState(link ? Boolean(link.nofollow) : false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const el = ref.current; if (el && !el.open) el.showModal(); }, []);
  const target = mode === 'page' ? page : href.trim();
  const save = async e => {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    const ok = await onSave({ href: target, text: link && link.textEditable ? text : undefined, newTab, nofollow });
    setBusy(false);
    if (ok) onClose();
  };
  const pages = targets.filter(t => t.kind !== 'post');
  const posts = targets.filter(t => t.kind === 'post');
  return (
    <dialog ref={ref} className="dialog dialog--wide" onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby="lk-dialog-title">
      <form onSubmit={save}>
        <div className="dialog__body">
          <h2 id="lk-dialog-title" className="dialog__title">{title}</h2>
          {words ? <p className="dialog__text">Words: <strong>“{words}”</strong></p> : null}
          {link && link.textEditable ? (
            <div className="field"><label className="field__label" htmlFor="lk-text">Words of the link</label><input id="lk-text" className="input" value={text} onChange={e => setText(e.target.value)} maxLength={200} /></div>
          ) : null}
          <fieldset className="plain lk-goes">
            <legend className="field__label">Goes to</legend>
            <label className="check"><input type="radio" name="lk-mode" checked={mode === 'page'} onChange={() => setMode('page')} /><span>A page of this website</span></label>
            {mode === 'page' ? (
              <select className="select" value={page} onChange={e => setPage(e.target.value)} aria-label="Page" data-testid="lk-page">
                <option value="">Choose a page…</option>
                <optgroup label="Pages">{pages.map(t => <option key={t.path} value={t.path}>{t.name} ({t.path})</option>)}</optgroup>
                {posts.length ? <optgroup label="JPK Updates posts">{posts.map(t => <option key={t.path} value={t.path}>{t.name}</option>)}</optgroup> : null}
              </select>
            ) : null}
            <label className="check"><input type="radio" name="lk-mode" checked={mode === 'address'} onChange={() => setMode('address')} /><span>Another address (another website, email, phone, a file)</span></label>
            {mode === 'address' ? <input className="input" value={href} onChange={e => setHref(e.target.value)} placeholder="https://… · name@example.com · +91 …" aria-label="Address" data-testid="lk-href" autoFocus /> : null}
          </fieldset>
          <label className="check" style={{ marginTop: 12 }}><input type="checkbox" checked={newTab} onChange={e => setNewTab(e.target.checked)} /><span>Open in a new tab</span></label>
          <label className="check"><input type="checkbox" checked={nofollow} onChange={e => setNofollow(e.target.checked)} /><span>nofollow <span className="muted small">(asks Google not to pass ranking to the linked page; for paid or untrusted links)</span></span></label>
        </div>
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--accent" disabled={!target || busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </dialog>
  );
}

// SEO › Links › one page: every link on it, where it goes, and changes; words of the page made a link; suggestions
export default function LinksPage({ page: initial, canEdit, websiteUrl }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [page, setPage] = useState(initial);
  const [filter, setFilter] = useState('');
  const [dialog, setDialog] = useState(null);
  const [words, setWords] = useState('');
  const [places, setPlaces] = useState(null);
  const [finding, setFinding] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = page.key;

  const send = async (body, message) => {
    try {
      setBusy(true);
      const r = await api('/api/admin/seo/links', { method: 'POST', body: { key, ...body } });
      setPage(r.page);
      toast.success(message || 'Saved. The change is live on the website.');
      return true;
    } catch (err) {
      toast.error(err.message);
      if (err.status === 409) { try { const r = await api(`/api/admin/seo/links?key=${encodeURIComponent(key)}`); setPage(r.page); } catch { /* keep the list */ } }
      return false;
    } finally {
      setBusy(false);
    }
  };
  const expect = l => ({ href: l.href, text: l.text });
  const edit = l => setDialog({ title: 'Change the link', link: l, onSave: v => send({ op: 'edit', loc: l.loc, expect: expect(l), ...v }) });
  const unlink = async l => {
    const button = l.unlinkLabel;
    if (!(await confirm({ title: button ? 'Remove the button?' : 'Remove this link?', message: button ? `The button “${l.text}” is taken off the page.` : `“${l.text}” stays on the page as normal text, without the link.`, confirmLabel: button ? 'Remove the button' : 'Remove the link' }))) return;
    send({ op: 'unlink', loc: l.loc, expect: expect(l) }, 'Link removed. The words stay on the page.');
  };
  const toNewAddress = l => send({ op: 'edit', loc: l.loc, expect: expect(l), href: l.to, newTab: l.newTab, nofollow: l.nofollow }, 'The link now goes to the new address.');
  const find = async e => {
    e.preventDefault();
    if (!words.trim()) return;
    setFinding(true);
    try {
      const r = await api(`/api/admin/seo/links?key=${encodeURIComponent(key)}&find=${encodeURIComponent(words.trim())}`);
      setPlaces(r.places);
    } catch (err) { toast.error(err.message); } finally { setFinding(false); }
  };
  const linkPlace = p => setDialog({ title: 'Make these words a link', words: p.match, onSave: async v => { const ok = await send({ op: 'add', place: { loc: p.loc, start: p.start, end: p.end, match: p.match }, ...v }, 'Link added. It is live on the website.'); if (ok) setPlaces(null); return ok; } });
  const addSuggestion = s => send({ op: 'add', place: s.place, href: s.to }, `“${s.phrase}” now links to ${s.name}.`);

  const links = page.links;
  const shown = useMemo(() => links.filter(l => !filter || (filter === 'problems' ? l.type === 'internal' && ['missing', 'redirect', 'hidden'].includes(l.status) : l.type === filter)), [links, filter]);
  const groups = useMemo(() => {
    const m = new Map();
    for (const l of shown) {
      const g = l.sectionName || 'Page';
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(l);
    }
    return [...m.entries()];
  }, [shown]);
  const c = page.counts;
  const isGlobal = key === 'global';
  const editHref = key.startsWith('post:') ? `/admin/blogs/${key.slice(5)}` : key.startsWith('custom:') ? `/admin/website/custom-${key.slice(7)}` : isGlobal ? '/admin/website/header-footer' : `/admin/website/${key.slice(5)}`;
  const chip = (v, label, n) => <button type="button" className={`seo-summary__item${filter === v ? ' is-on' : ''}`} onClick={() => setFilter(filter === v ? '' : v)} data-filter={v}><strong>{n}</strong> {label}</button>;

  return (
    <>
      <PageHeader back={{ href: '/admin/website/seo/links', label: 'Links' }} title={`Links: ${page.name}`}
        description={isGlobal ? <>The header and footer are on every page. The menu is changed in <Link href="/admin/website/menu">Menu</Link>.</> : <>The page <a href={`${websiteUrl}${page.path}`} target="_blank" rel="noopener noreferrer">{page.path} ↗</a> · its texts are changed in <Link href={editHref}>{key.startsWith('post:') ? 'the post' : 'Pages & sections'}</Link>.</>} />
      <SeoNav />
      <div className="seo-summary" data-testid="lk-counts">
        {chip('internal', 'internal', c.internal)}
        {chip('external', 'external', c.external)}
        {c.contact ? chip('contact', 'email / phone', c.contact) : null}
        {chip('problems', 'to check', c.problems)}
        {!isGlobal ? <span className="seo-summary__item" title="Other pages whose text links to this page"><strong>{page.linkedFrom.length}</strong> pages link here</span> : null}
      </div>
      <div className="editor-grid">
        <div>
          <Card title={`All links (${links.filter(l => !l.hidden).length})`} className="lk-card">
            {!shown.length ? <EmptyState title={filter ? 'No links of this kind' : 'No links on this page yet'} text={filter ? 'Choose another filter above.' : 'Add one with “Add a link” on the right.'} /> : groups.map(([name, list]) => (
              <div key={name} className="lk-group">
                <h3 className="lk-group__title">{name}</h3>
                <ul className="lk-list">
                  {list.map(l => {
                    const problem = l.type === 'internal' && ['missing', 'redirect', 'hidden'].includes(l.status);
                    return (
                      <li key={l.id} className={`lk-row${l.fixed ? ' lk-row--fixed' : ''}${l.hidden ? ' lk-row--hidden' : ''}`} data-link={l.id} data-type={l.type} data-status={l.status || ''}>
                        <span className={`lk-type lk-type--${l.type}`}>{TYPE[l.type] || l.type}</span>
                        <div className="lk-main">
                          <span className="lk-text">{l.text || (l.picture ? <em className="lk-pic">Picture: {l.picture}</em> : <em className="muted">(a picture or icon, no words)</em>)}</span>
                          <span className="lk-href">→ {address(l)}</span>
                          <span className="lk-meta">{l.where}{l.newTab ? ' · opens in a new tab' : ''}{l.nofollow ? ' · nofollow' : ''}{l.hidden ? ' · in a hidden section (not on the website)' : ''}</span>
                          {problem ? (
                            <span className="lk-warn" role="note">
                              {l.status === 'redirect' ? <>Old address: it is forwarded to {l.toName || l.to}. Link straight to the new address.</> : l.status === 'missing' ? 'No page at this address: visitors get “page not found”.' : 'Goes to a page that is switched off.'}
                              {l.status === 'redirect' && canEdit && !l.fixed ? <button type="button" className="btn btn--link btn--sm" onClick={() => toNewAddress(l)} disabled={busy}>Use the new address</button> : null}
                            </span>
                          ) : null}
                        </div>
                        <div className="lk-actions">
                          {l.fixed ? (
                            <span className="muted small">{l.where === 'Menu' ? <Link href="/admin/website/menu">Change in Menu</Link> : l.where === 'Product card' ? 'The same on every product card' : 'Part of the page design'}</span>
                          ) : canEdit ? (
                            <>
                              <button type="button" className="btn btn--ghost btn--sm" onClick={() => edit(l)} disabled={busy}>Edit</button>
                              {l.canUnlink ? <button type="button" className="btn btn--ghost btn--sm lk-remove" onClick={() => unlink(l)} disabled={busy}>{l.unlinkLabel ? 'Remove' : 'Remove link'}</button> : null}
                            </>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </Card>
        </div>
        <div className="editor-grid__side">
          {canEdit && page.canAdd ? (
            <Card title="Add a link">
              <form onSubmit={find} className="lk-find">
                <label className="field__label" htmlFor="lk-words">Words on this page to make a link</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="lk-words" className="input" value={words} onChange={e => setWords(e.target.value)} placeholder="e.g. ductile iron" maxLength={120} />
                  <button type="submit" className="btn btn--primary" disabled={!words.trim() || finding}>{finding ? 'Finding…' : 'Find'}</button>
                </div>
              </form>
              {places ? (places.length ? (
                <ul className="lk-places" data-testid="lk-places">
                  {places.map((p, i) => (
                    <li key={i}>
                      <span className="small muted">{p.sectionName}{p.heading ? ' · heading' : ''}</span>
                      <span className="lk-snippet">…{p.before}<mark>{p.match}</mark>{p.after}…</span>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => linkPlace(p)} disabled={busy}>Link these words</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="small muted" style={{ marginTop: 10 }}>These words are not in the page's texts (outside existing links). Try fewer words.</p>) : <p className="small muted" style={{ marginTop: 10 }}>The words are linked where you choose; their look stays the same as the text around them.</p>}
            </Card>
          ) : null}
          {canEdit && page.suggestions && page.suggestions.length ? (
            <Card title="Link suggestions" className="lk-suggest">
              <p className="small muted" style={{ marginTop: -4 }}>Words on this page that name other pages it does not link to yet. Internal links help Google and visitors find those pages.</p>
              <ul className="lk-places" data-testid="lk-suggestions">
                {page.suggestions.map((s, i) => (
                  <li key={i}>
                    <span className="small"><strong>“{s.phrase}”</strong> → {s.name} <span className="muted">{s.to}</span></span>
                    <span className="lk-snippet">…{s.before}<mark>{s.place.match}</mark>{s.after}…</span>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => addSuggestion(s)} disabled={busy}>Add this link</button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {!isGlobal ? (
            <Card title="Pages linking here">
              {page.linkedFrom.length ? (
                <ul className="lk-from">{page.linkedFrom.map(p => <li key={p.key}><Link href={linksHref(p.key)}>{p.name}</Link></li>)}</ul>
              ) : <p className="small muted" style={{ margin: 0 }}>No other page links to this one in its text yet{page.path === '/' ? ' (the logo in the header links to the home page)' : ''}. Links from related pages help Google see it as important.</p>}
            </Card>
          ) : null}
          {!canEdit ? <Notice tone="info">You can look at the links; changing them needs the right to edit the website{key.startsWith('post:') ? ' (or JPK Updates)' : ''}.</Notice> : null}
        </div>
      </div>
      {dialog ? <LinkDialog {...dialog} targets={page.targets} onClose={() => setDialog(null)} /> : null}
      {confirmDialog}
    </>
  );
}
