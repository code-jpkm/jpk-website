'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { Card, Field, PageHeader, Notice } from '@/components/ui';
import DailyChart from '@/components/analytics/DailyChart';
import SeoNav from './SeoNav';

const fmt = v => Number(v || 0).toLocaleString('en-IN');

function Kpi({ label, value, before, unit = '', lowerIsBetter = false, digits = 0 }) {
  const has = before !== null && before !== undefined && before !== 0;
  const diff = has ? value - before : 0;
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <div className="ga-kpi">
      <div className="ga-kpi__label">{label}</div>
      <div className="ga-kpi__value">{digits ? Number(value || 0).toFixed(digits) : fmt(value)}{unit}</div>
      {has && diff !== 0 ? <div className={`ga-kpi__change ga-kpi__change--${better ? 'up' : 'down'}`}>{better ? '▲' : '▼'} {Math.abs(diff).toFixed(digits)}{unit} <span className="muted">vs before</span></div> : null}
    </div>
  );
}

function Change({ value }) {
  if (value === null || value === undefined || value === 0) return null;
  return <span className={`rk-change rk-change--${value > 0 ? 'up' : 'down'}`} title={value > 0 ? `Up ${value} places` : `Down ${Math.abs(value)} places`}>{value > 0 ? '▲' : '▼'}{Math.abs(value)}</span>;
}

// SEO › Rankings: what people searched on Google when they saw the website, its position, clicks; the pages'
// keyphrases and where they rank (Google Search Console)
export default function RankingsView({ status: initialStatus, canEdit, websiteUrl, keyphrases, pages }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [status, setStatus] = useState(initialStatus);
  const [days, setDays] = useState(28);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const [site, setSite] = useState(status.siteUrl || websiteUrl.replace(/^https?:\/\/(www\.)?/, ''));
  const [useGa, setUseGa] = useState(Boolean(status.gaEmail));
  const [keyText, setKeyText] = useState('');
  const [keyName, setKeyName] = useState('');
  const [busy, setBusy] = useState('');

  const load = async (d, fresh = false) => {
    setLoading(true); setError('');
    try {
      const r = await api(`/api/admin/seo/rankings?days=${d}${fresh ? '&fresh=1' : ''}`);
      setStatus(r.status); setReport(r.report);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => { if (status.connected) load(days); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const readKey = file => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => { setKeyText(String(fr.result || '')); setKeyName(file.name); };
    fr.readAsText(file);
  };
  const connect = async () => {
    setBusy('connect');
    try {
      const r = await api('/api/admin/seo/rankings/connection', { method: 'PUT', body: useGa ? { siteUrl: site, useGa: true } : { siteUrl: site, key: keyText } });
      setStatus(r.status); setKeyText(''); setKeyName('');
      toast.success('Search Console is connected.');
      load(days, true);
    } catch (err) { toast.error(err.message); } finally { setBusy(''); }
  };
  const disconnect = async () => {
    if (!(await confirm({ title: 'Disconnect Search Console?', message: 'The rankings disappear from the admin. Nothing changes on the website or in Search Console.', confirmLabel: 'Disconnect' }))) return;
    setBusy('disconnect');
    try { const r = await api('/api/admin/seo/rankings/connection', { method: 'DELETE' }); setStatus(r.status); setReport(null); } catch (err) { toast.error(err.message); } finally { setBusy(''); }
  };

  const queries = useMemo(() => (report ? report.queries : []), [report]);
  const shownQ = useMemo(() => queries.filter(x => !q || x.query.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions), [queries, q]);
  const byQuery = useMemo(() => new Map(queries.map(x => [x.query.toLowerCase().trim(), x])), [queries]);
  const pageName = useMemo(() => new Map(pages.map(p => [p.path, p])), [pages]);
  const r = report;

  return (
    <>
      <PageHeader title="Rankings" description="Where the website shows in Google: the searches people made, the position, how often it was shown and clicked (Google Search Console)."
        actions={status.connected ? <div className="ga-range" role="group" aria-label="Period">{[7, 28, 90].map(d => <button key={d} type="button" className={`btn btn--sm ${days === d ? 'btn--primary' : 'btn--ghost'}`} aria-pressed={days === d} onClick={() => setDays(d)}>{d} days</button>)}</div> : null} />
      <SeoNav />
      {status.connected ? (
        <>
          {error ? <Notice tone="danger" title="The rankings could not be loaded">{error}</Notice> : null}
          {r ? (
            <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .2s' }} data-testid="rk-report">
              <p className="muted small" style={{ margin: '-4px 0 12px' }}>{r.start} to {r.end} (Search Console is about 2 days behind), updated every hour. <button type="button" className="btn btn--link btn--sm" onClick={() => load(days, true)}>Refresh</button></p>
              <div className="ga-kpis">
                <Kpi label="Clicks from Google" value={r.totals.clicks} before={r.previous.clicks} />
                <Kpi label="Times shown in Google" value={r.totals.impressions} before={r.previous.impressions} />
                <Kpi label="Click rate" value={r.totals.ctr} before={r.previous.ctr} unit="%" digits={1} />
                <Kpi label="Average position" value={r.totals.position} before={r.previous.position} lowerIsBetter digits={1} />
              </div>
              {r.daily.length ? <Card title="Clicks per day"><DailyChart data={r.daily} field="clicks" label="Clicks" /></Card> : null}
              <Card title="Your keyphrases" className="rk-card">
                {keyphrases.length ? (
                  <table className="table table--compact" data-testid="rk-keyphrases">
                    <thead><tr><th>Keyphrase</th><th>Page</th><th className="num">Position</th><th className="num">Clicks</th><th className="num">Shown</th></tr></thead>
                    <tbody>
                      {keyphrases.map(k => {
                        const hit = byQuery.get(k.keyphrase.toLowerCase().trim());
                        return (
                          <tr key={`${k.key}:${k.keyphrase}`}>
                            <td>{k.keyphrase}{k.main ? '' : <span className="muted small"> · extra</span>}</td>
                            <td className="small"><Link href={k.key.startsWith('custom:') ? `/admin/website/seo/custom-${k.key.slice(7)}` : `/admin/website/seo/${k.key.slice(5)}`}>{k.name}</Link></td>
                            <td className="num">{hit ? <><strong>{hit.position}</strong> <Change value={hit.change} /></> : <span className="muted small">not yet</span>}</td>
                            <td className="num">{hit ? fmt(hit.clicks) : '—'}</td>
                            <td className="num">{hit ? fmt(hit.impressions) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : <p className="small muted" style={{ margin: 0 }}>No page has a focus keyphrase yet. Add one on each page in <Link href="/admin/website/seo">SEO › Pages</Link>; its position appears here.</p>}
              </Card>
              <Card title={`Searches (${queries.length})`} className="rk-card" actions={<input className="input input--sm rk-search" type="search" placeholder="Find a search" value={q} onChange={e => setQ(e.target.value)} aria-label="Find a search" />}>
                {shownQ.length ? (
                  <>
                    <table className="table table--compact" data-testid="rk-queries">
                      <thead><tr><th>What people searched</th><th className="num">Position</th><th className="num">Clicks</th><th className="num">Shown</th><th className="num hide-sm">Click rate</th></tr></thead>
                      <tbody>{shownQ.slice(0, all ? 250 : 25).map(x => <tr key={x.query}><td>{x.query}</td><td className="num">{x.position} <Change value={x.change} /></td><td className="num">{fmt(x.clicks)}</td><td className="num">{fmt(x.impressions)}</td><td className="num hide-sm">{x.ctr}%</td></tr>)}</tbody>
                    </table>
                    {shownQ.length > 25 && !all ? <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={() => setAll(true)}>Show more</button> : null}
                  </>
                ) : <p className="small muted" style={{ margin: 0 }}>{q ? 'No search matches.' : 'Google has not shown the website for any search in this period yet.'}</p>}
              </Card>
              <Card title="Pages in Google" className="rk-card">
                {r.pages.length ? (
                  <table className="table table--compact" data-testid="rk-pages">
                    <thead><tr><th>Page</th><th className="num">Clicks</th><th className="num">Shown</th><th className="num">Position</th></tr></thead>
                    <tbody>{r.pages.slice(0, 50).map(p => { const known = pageName.get(p.path); return <tr key={p.url}><td>{known ? <Link href={known.href}>{known.name}</Link> : null} <span className="muted small">{p.path}</span></td><td className="num">{fmt(p.clicks)}</td><td className="num">{fmt(p.impressions)}</td><td className="num">{p.position}</td></tr>; })}</tbody>
                  </table>
                ) : <p className="small muted" style={{ margin: 0 }}>No pages in this period.</p>}
              </Card>
            </div>
          ) : !error ? <p className="muted">Asking Search Console…</p> : null}
        </>
      ) : null}
      <Card title={status.connected ? 'Search Console connection' : 'Connect Google Search Console'} className="rk-connect">
        {status.connected ? (
          <>
            <p className="small" data-testid="rk-connected" style={{ margin: 0 }}><strong>Connected</strong> to <code>{status.siteUrl}</code> as <code>{status.clientEmail}</code>{status.useGa ? ' (the Google Analytics key)' : ''}{status.source === 'environment' ? ' (set on the server)' : ''}.</p>
            {canEdit && status.source !== 'environment' ? <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 10 }} onClick={disconnect} disabled={busy === 'disconnect'}>Disconnect</button> : null}
          </>
        ) : (
          <>
            {status.broken ? <Notice tone="warn" title="Connect again">{status.needsKey ? 'It used the Google Analytics key, which is not connected any more.' : 'The saved key can no longer be read.'}</Notice> : null}
            <ol className="ga-steps">
              <li>At <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">search.google.com/search-console ↗</a> add the website with the company’s Google account. <strong>Domain</strong> (jpkm.in) is best: Google gives a TXT record to add at the company that registered the domain. (Or <strong>URL prefix</strong> https://jpkm.in/ with the HTML tag code in <Link href="/admin/website/seo/settings">SEO › Settings</Link>, once the new website is live.)</li>
              <li>In Search Console › Settings › Users and permissions › Add user, add {status.gaEmail ? <code>{status.gaEmail}</code> : 'the service account’s email (…@….iam.gserviceaccount.com, the same as for Google Analytics)'} with <strong>Restricted</strong> permission.</li>
              <li>In <a href="https://console.cloud.google.com/apis/library/searchconsole.googleapis.com" target="_blank" rel="noopener noreferrer">Google Cloud ↗</a> switch on the “Google Search Console API” for the key’s project.</li>
              <li>Enter the property below and connect. Google needs a few days after adding a new property before rankings appear.</li>
            </ol>
            <fieldset className="plain" disabled={!canEdit || busy === 'connect'} style={{ marginTop: 14 }}>
              <Field label="Search Console property" htmlFor="rk-site" hint="The domain (jpkm.in) for a Domain property, or https://jpkm.in/ for a URL-prefix property.">
                <input id="rk-site" className="input" value={site} onChange={e => setSite(e.target.value)} placeholder="jpkm.in" maxLength={200} />
              </Field>
              {status.gaEmail ? (
                <label className="check" style={{ marginBottom: 12 }}><input type="checkbox" checked={useGa} onChange={e => setUseGa(e.target.checked)} /><span>Use the Google Analytics key (<code>{status.gaEmail}</code>)</span></label>
              ) : null}
              {!useGa || !status.gaEmail ? (
                <Field label="Key file (.json)" htmlFor="rk-key" hint={keyName ? `Chosen: ${keyName}` : 'A service account key from Google Cloud (as for Google Analytics). Kept safely on the server; it only allows reading.'}>
                  <input id="rk-key" type="file" accept=".json,application/json" onChange={e => readKey(e.target.files && e.target.files[0])} />
                </Field>
              ) : null}
              <button type="button" className="btn btn--accent" onClick={connect} disabled={!site.trim() || (!(useGa && status.gaEmail) && !keyText)}>{busy === 'connect' ? 'Connecting…' : 'Connect'}</button>
            </fieldset>
          </>
        )}
      </Card>
      {confirmDialog}
    </>
  );
}
