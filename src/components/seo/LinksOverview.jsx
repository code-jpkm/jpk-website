'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { Card, PageHeader, EmptyState } from '@/components/ui';
import SeoNav, { linksHref } from './SeoNav';

// Website › SEO › Links: how many links each page has to other pages of the website (internal) and to other
// websites (external), how many pages link to it, and links that need attention.
export default function LinksOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [show, setShow] = useState('');
  useEffect(() => {
    api('/api/admin/seo/links').then(setData).catch(err => setError(err.message));
  }, []);
  const rows = useMemo(() => (data ? data.rows : []), [data]);
  const orphan = r => !r.hidden && r.path !== '/' && r.inbound === 0;
  const shown = useMemo(() => rows.filter(r => (!q || `${r.name} ${r.path}`.toLowerCase().includes(q.toLowerCase()))
    && (show !== 'problems' || r.problems > 0) && (show !== 'orphans' || orphan(r)) && (show !== 'posts' || r.kind === 'post') && (show !== 'pages' || r.kind !== 'post')), [rows, q, show]);
  const totals = useMemo(() => rows.filter(r => !r.hidden).reduce((t, r) => ({ internal: t.internal + r.internal, external: t.external + r.external, problems: t.problems + r.problems, orphans: t.orphans + (orphan(r) ? 1 : 0) }), { internal: 0, external: 0, problems: 0, orphans: 0 }), [rows]);
  const toggle = v => setShow(show === v ? '' : v);
  return (
    <>
      <PageHeader title="Links" description="The links on each page: to other pages of the website (internal) and to other websites (external). Open a page to change, remove or add links." />
      <SeoNav />
      {data ? (
        <div className="seo-summary" data-testid="links-summary">
          <span className="seo-summary__item"><strong>{totals.internal}</strong> internal links</span>
          <span className="seo-summary__item"><strong>{totals.external}</strong> external links</span>
          <button type="button" className={`seo-summary__item${show === 'problems' ? ' is-on' : ''}`} onClick={() => toggle('problems')}><span className={`seo-score__dot lk-dot--${totals.problems ? 'bad' : 'good'}`} aria-hidden="true" /><strong>{totals.problems}</strong> to check</button>
          <button type="button" className={`seo-summary__item${show === 'orphans' ? ' is-on' : ''}`} onClick={() => toggle('orphans')} title="Pages that no other page links to in its text (they may still be in the menu)"><strong>{totals.orphans}</strong> not linked from other pages</button>
        </div>
      ) : null}
      <Card pad={false}>
        <div className="toolbar">
          <div className="toolbar__search"><input className="input" type="search" placeholder="Search pages" value={q} onChange={e => setQ(e.target.value)} aria-label="Search pages" /></div>
          <select className="select" value={['pages', 'posts'].includes(show) ? show : ''} onChange={e => setShow(e.target.value)} aria-label="Kind">
            <option value="">Pages and posts</option>
            <option value="pages">Pages</option>
            <option value="posts">JPK Updates posts</option>
          </select>
        </div>
        {error ? <p className="muted" style={{ padding: 20 }}>{error}</p> : !data ? <p className="muted" style={{ padding: 20 }}>Reading the links of every page…</p> : !shown.length ? <EmptyState title="No pages match" text="Try another search or filter." /> : (
          <table className="table seo-table" data-testid="links-table">
            <thead>
              <tr>
                <th>Page</th>
                <th className="num" title="Links to other pages of this website">Internal</th>
                <th className="num" title="Links to other websites">External</th>
                <th className="num hide-sm" title="Other pages whose text links to this page">Linked from</th>
                <th>To check</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {!q && !show && data.global ? (
                <tr data-key="global">
                  <td><Link href={linksHref('global')} className="table__title">Header and footer</Link><span className="table__sub">on every page · the menu is changed in Menu</span></td>
                  <td className="num">{data.global.internal}</td>
                  <td className="num">{data.global.external}</td>
                  <td className="num hide-sm muted">—</td>
                  <td>{data.global.problems ? <span className="lk-problem">{data.global.problems}</span> : <span className="muted small">—</span>}</td>
                  <td><div className="table__actions"><Link href={linksHref('global')} className="btn btn--ghost btn--sm">Links</Link></div></td>
                </tr>
              ) : null}
              {shown.map(r => (
                <tr key={r.key} data-key={r.key}>
                  <td>
                    <Link href={linksHref(r.key)} className="table__title">{r.name}</Link>
                    <span className="table__sub">{r.path}{r.kind === 'post' ? ' · post' : ''}{r.hidden ? ' · switched off' : ''}</span>
                  </td>
                  <td className="num">{r.internal}</td>
                  <td className="num">{r.external}</td>
                  <td className="num hide-sm">{r.path === '/' ? <span className="muted">—</span> : r.inbound ? r.inbound : <span className="lk-zero" title={r.inMenu ? 'In the menu, but no other page links to it in its text' : 'No other page links to it'}>0{r.inMenu ? ' (menu)' : ''}</span>}</td>
                  <td>{r.problems ? <span className="lk-problem" title="Links to old addresses, missing or switched-off pages">{r.problems} link{r.problems === 1 ? '' : 's'}</span> : <span className="muted small">—</span>}</td>
                  <td><div className="table__actions"><Link href={linksHref(r.key)} className="btn btn--ghost btn--sm">Links</Link></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
