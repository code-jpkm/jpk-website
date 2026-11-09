'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { Card } from '@/components/ui';

// "In Google" on a page's SEO screen: the searches the page was shown for (Search Console), with its position
export default function PageRankings({ path, keyphrases = [], connected }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!connected) return;
    api(`/api/admin/seo/rankings?path=${encodeURIComponent(path)}`).then(r => setData(r.page || { queries: [], totals: null })).catch(err => setError(err.message));
  }, [connected, path]);
  if (!connected) {
    return (
      <Card title="In Google">
        <p className="small muted" style={{ margin: 0 }}>See which searches show this page and at which position: connect Google Search Console in <Link href="/admin/website/seo/rankings">SEO › Rankings</Link>.</p>
      </Card>
    );
  }
  const lower = s => String(s || '').toLowerCase().trim();
  const found = data ? keyphrases.map(k => ({ k, q: data.queries.find(q => lower(q.query) === lower(k)) })) : [];
  return (
    <Card title="In Google (28 days)">
      {error ? <p className="small muted" style={{ margin: 0 }}>{error}</p> : !data ? <p className="small muted" style={{ margin: 0 }}>Asking Search Console…</p> : (
        <div data-testid="page-rankings">
          {data.totals ? <p className="small" style={{ margin: '0 0 10px' }}><strong>{data.totals.clicks}</strong> clicks · <strong>{data.totals.impressions}</strong> times shown · position <strong>{data.totals.position || '—'}</strong></p> : null}
          {found.length ? (
            <ul className="rk-kps">
              {found.map(({ k, q }) => <li key={k}><span>{k}</span>{q ? <strong className="rk-pos">#{q.position}</strong> : <span className="muted small">not in the results yet</span>}</li>)}
            </ul>
          ) : null}
          {data.queries.length ? (
            <table className="table table--compact rk-mini">
              <thead><tr><th>Search</th><th className="num">Position</th><th className="num">Clicks</th></tr></thead>
              <tbody>{data.queries.slice(0, 8).map(q => <tr key={q.query}><td>{q.query}</td><td className="num">{q.position}</td><td className="num">{q.clicks}</td></tr>)}</tbody>
            </table>
          ) : <p className="small muted" style={{ margin: 0 }}>Google has not shown this page for any search in the last 28 days.</p>}
        </div>
      )}
    </Card>
  );
}
