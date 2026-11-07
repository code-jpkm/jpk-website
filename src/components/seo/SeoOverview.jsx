'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { Card, PageHeader, EmptyState } from '@/components/ui';
import SeoNav, { ScoreDot } from './SeoNav';

// Website › SEO: every page and post with its Google title, description, focus keyphrase and SEO check
export default function SeoOverview({ gaSet }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [score, setScore] = useState('');
  useEffect(() => {
    api('/api/admin/seo/overview').then(r => setRows(r.rows || [])).catch(err => setError(err.message));
  }, []);
  const shown = useMemo(() => (rows || []).filter(r => (!kind || (kind === 'post' ? r.kind === 'post' : r.kind !== 'post'))
    && (!score || r.score === score)
    && (!q || `${r.name} ${r.path} ${r.focus} ${r.title}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, kind, score]);
  const counts = useMemo(() => (rows || []).reduce((m, r) => ({ ...m, [r.score]: (m[r.score] || 0) + 1 }), {}), [rows]);
  const len = (s, a, b) => { const n = String(s || '').length; return <span className={`seo-len seo-len--${!n ? 'bad' : n >= a && n <= b ? 'good' : 'ok'}`}>{n}</span>; };
  return (
    <>
      <PageHeader title="SEO" description="How each page shows in Google, and what to improve. Changes are live on the website as soon as they are saved." />
      <SeoNav />
      {!gaSet ? <p className="seo-tip small">Tip: add Google Analytics in <Link href="/admin/analytics">Analytics</Link> to see how many people visit and how they find the website.</p> : null}
      {rows ? (
        <div className="seo-summary">
          <button type="button" className={`seo-summary__item${score === 'good' ? ' is-on' : ''}`} onClick={() => setScore(score === 'good' ? '' : 'good')}><ScoreDot score="good" label={false} /><strong>{counts.good || 0}</strong> good</button>
          <button type="button" className={`seo-summary__item${score === 'ok' ? ' is-on' : ''}`} onClick={() => setScore(score === 'ok' ? '' : 'ok')}><ScoreDot score="ok" label={false} /><strong>{counts.ok || 0}</strong> could be better</button>
          <button type="button" className={`seo-summary__item${score === 'bad' ? ' is-on' : ''}`} onClick={() => setScore(score === 'bad' ? '' : 'bad')}><ScoreDot score="bad" label={false} /><strong>{counts.bad || 0}</strong> need work</button>
        </div>
      ) : null}
      <Card pad={false}>
        <div className="toolbar">
          <div className="toolbar__search"><input className="input" type="search" placeholder="Search pages" value={q} onChange={e => setQ(e.target.value)} aria-label="Search pages" /></div>
          <select className="select" value={kind} onChange={e => setKind(e.target.value)} aria-label="Kind">
            <option value="">Pages and posts</option>
            <option value="page">Pages</option>
            <option value="post">JPK Updates posts</option>
          </select>
        </div>
        {error ? <p className="muted" style={{ padding: 20 }}>{error}</p> : !rows ? <p className="muted" style={{ padding: 20 }}>Checking the pages…</p> : !shown.length ? <EmptyState title="No pages match" text="Try another search." /> : (
          <table className="table seo-table" data-testid="seo-table">
            <thead>
              <tr>
                <th>Page</th>
                <th className="hide-sm">Focus keyphrase</th>
                <th className="hide-sm" title="Characters in the search title (30–60 is best)">Title</th>
                <th className="hide-sm" title="Characters in the search description (120–160 is best)">Description</th>
                <th>SEO</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.key} data-key={r.key}>
                  <td>
                    <Link href={r.href} className="table__title">{r.name}</Link>
                    <span className="table__sub">{r.path}{r.kind === 'post' ? ' · post' : ''}{r.hidden ? ' · hidden page' : ''}{r.noindex ? ' · hidden from Google' : ''}</span>
                  </td>
                  <td className="small hide-sm">{r.focus || <span className="muted">—</span>}</td>
                  <td className="hide-sm">{len(r.title, 30, 60)}</td>
                  <td className="hide-sm">{len(r.description, 110, 165)}</td>
                  <td><ScoreDot score={r.score} /></td>
                  <td><div className="table__actions"><Link href={r.href} className="btn btn--ghost btn--sm">{r.kind === 'post' ? 'Open post' : 'Improve'}</Link></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
