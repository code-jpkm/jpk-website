'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { Card, Field, PageHeader, Notice } from '@/components/ui';
import SeoNav from '@/components/seo/SeoNav';
import DailyChart from './DailyChart';

const compact = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 10000 ? `${(n / 1000).toFixed(1)}K` : Math.round(n).toLocaleString('en-IN'));
const duration = s => { const m = Math.floor(s / 60); const r = Math.round(s % 60); return m ? `${m} min ${r} s` : `${r} s`; };
const DEVICE = { desktop: 'Computers', mobile: 'Phones', tablet: 'Tablets' };

function Kpi({ label, value, now, before, shown }) {
  const pct = before > 0 ? ((now - before) / before) * 100 : null;
  return (
    <div className="ga-kpi">
      <div className="ga-kpi__label">{label}</div>
      <div className="ga-kpi__value">{shown}</div>
      {pct == null ? <div className="ga-kpi__change muted">no earlier numbers</div> : (
        <div className={`ga-kpi__change ga-kpi__change--${pct >= 0 ? 'up' : 'down'}`}>{pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% <span className="muted">vs the {value} days before</span></div>
      )}
    </div>
  );
}

function Ranked({ title, rows, value, label, empty = 'No numbers yet.' }) {
  const max = Math.max(1, ...rows.map(r => r[value]));
  const total = rows.reduce((s, r) => s + r[value], 0) || 1;
  return (
    <Card title={title}>
      {rows.length ? rows.map((r, i) => (
        <div key={i} className="ga-bar" title={`${label(r)}: ${r[value].toLocaleString('en-IN')} (${Math.round((r[value] * 100) / total)}%)`}>
          <span className="ga-bar__label">{label(r)}</span>
          <span className="ga-bar__value">{r[value].toLocaleString('en-IN')}</span>
          <span className="ga-bar__track"><span style={{ width: `${Math.max(2, (r[value] * 100) / max)}%` }} /></span>
        </div>
      )) : <p className="muted small">{empty}</p>}
    </Card>
  );
}

// Analytics: (1) the Google Analytics tag on the website, (2) the connection that shows the numbers here, (3) the
// numbers: visitors, sessions, page views, time on the site, per day, top pages, how people come, devices, countries.
export default function AnalyticsView({ initial, websiteUrl, canEdit }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [status, setStatus] = useState(initial.status);
  const [measurementId, setMeasurementId] = useState(initial.measurementId || '');
  const [gaInput, setGaInput] = useState(initial.measurementId || '');
  const [days, setDays] = useState(28);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [keyText, setKeyText] = useState('');
  const [keyName, setKeyName] = useState('');

  const load = useCallback(async (d, fresh = false) => {
    setLoading(true); setError('');
    try {
      const r = await api(`/api/admin/analytics?days=${d}${fresh ? '&fresh=1' : ''}`);
      setStatus(r.status); setReport(r.report);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (status.connected) load(days); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveId = async () => {
    setBusy('id');
    try {
      const part = await api('/api/admin/site/part?key=seo');
      const data = { ...(part.data || {}), analytics: gaInput.trim() ? { ga4: gaInput.trim().toUpperCase() } : undefined };
      const r = await api('/api/admin/site/part?key=seo', { method: 'PUT', body: { data, updatedAt: part.updatedAt } });
      const id = (r.data && r.data.analytics && r.data.analytics.ga4) || '';
      setMeasurementId(id); setGaInput(id);
      toast.success(id ? `Saved. Every page of the website now counts its visitors with ${id}.` : 'Removed. The website no longer counts visitors.');
    } catch (err) { toast.error(err.message); } finally { setBusy(''); }
  };
  const readKey = async file => {
    if (!file) return;
    if (file.size > 50000) { toast.error('That file is too big for a key file.'); return; }
    setKeyText(await file.text()); setKeyName(file.name);
  };
  const connect = async () => {
    setBusy('connect');
    try {
      const r = await api('/api/admin/analytics/connection', { method: 'PUT', body: { propertyId, key: keyText } });
      setStatus(r.status); setKeyText(''); setKeyName('');
      toast.success('Connected. Loading the numbers…');
      load(days, true);
    } catch (err) { toast.error(err.message); } finally { setBusy(''); }
  };
  const disconnect = async () => {
    if (!(await confirm({ title: 'Disconnect Google Analytics?', message: 'The numbers disappear from the admin. The website keeps counting visitors (the measurement ID stays).', confirmLabel: 'Disconnect' }))) return;
    setBusy('disconnect');
    try { const r = await api('/api/admin/analytics/connection', { method: 'DELETE' }); setStatus(r.status); setReport(null); } catch (err) { toast.error(err.message); } finally { setBusy(''); }
  };

  const t = report && report.totals, p = report && report.previous;
  return (
    <>
      <PageHeader title="Analytics" description="How many people visit the website, which pages they read and how they find it (Google Analytics)."
        actions={status.connected ? <div className="ga-range" role="group" aria-label="Period">{[7, 28, 90].map(d => <button key={d} type="button" className={`btn btn--sm ${days === d ? 'btn--primary' : 'btn--ghost'}`} aria-pressed={days === d} onClick={() => setDays(d)}>{d} days</button>)}</div> : null} />
      <SeoNav />
      {status.connected ? (
        <>
          {error ? <Notice tone="danger" title="The numbers could not be loaded">{error}</Notice> : null}
          {report ? (
            <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .2s' }} data-testid="ga-report">
              <p className="muted small" style={{ margin: '-4px 0 12px' }}>
                {report.live != null ? <span className="ga-live">{report.live} on the website right now</span> : null}
                {report.live != null ? ' · ' : ''}The last {report.range} days, updated every 10 minutes. <button type="button" className="btn btn--link btn--sm" onClick={() => load(days, true)}>Refresh</button>
              </p>
              <div className="ga-kpis">
                <Kpi label="Visitors" value={report.range} now={t.users} before={p.users} shown={compact(t.users)} />
                <Kpi label="New visitors" value={report.range} now={t.newUsers} before={p.newUsers} shown={compact(t.newUsers)} />
                <Kpi label="Visits" value={report.range} now={t.sessions} before={p.sessions} shown={compact(t.sessions)} />
                <Kpi label="Pages viewed" value={report.range} now={t.views} before={p.views} shown={compact(t.views)} />
                <Kpi label="Average visit" value={report.range} now={t.avgSession} before={p.avgSession} shown={duration(t.avgSession)} />
              </div>
              <Card title="Visitors per day">
                <DailyChart data={report.daily} />
              </Card>
              <div className="ga-grid">
                <Ranked title="Most viewed pages" rows={report.pages} value="views" label={r => r.title && r.title !== '(not set)' ? `${r.title.replace(/\s*\|\s*JPK Metallics$/, '')} (${r.path})` : r.path} />
                <Ranked title="How people come" rows={report.sources} value="sessions" label={r => r.name} />
                <Ranked title="Devices" rows={report.devices} value="users" label={r => DEVICE[r.name] || r.name} />
                <Ranked title="Countries" rows={report.countries} value="users" label={r => r.name} />
              </div>
            </div>
          ) : !error ? <p className="muted">Loading the numbers…</p> : null}
        </>
      ) : null}
      <div className="ga-grid" style={{ marginTop: 16 }}>
        <Card title="1. Count the visitors">
          {measurementId ? <p className="small" data-testid="ga-tag-on"><strong>On:</strong> every page of the website counts its visitors with <code>{measurementId}</code>.</p> : (
            <ol className="ga-steps">
              <li>Open <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer">analytics.google.com ↗</a> with the company’s Google account and create a property for {websiteUrl.replace(/^https?:\/\//, '')} (Admin › Create › Property).</li>
              <li>Add a Web data stream for {websiteUrl}.</li>
              <li>Copy its Measurement ID (starts with G-) here and save.</li>
            </ol>
          )}
          <fieldset className="plain" disabled={!canEdit || busy === 'id'}>
            <Field label="Measurement ID" htmlFor="ga-id" hint="Leave empty and save to stop counting.">
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="ga-id" className="input" value={gaInput} onChange={e => setGaInput(e.target.value)} placeholder="G-XXXXXXXXXX" maxLength={20} />
                <button type="button" className="btn btn--accent" onClick={saveId} disabled={gaInput.trim().toUpperCase() === measurementId}>{busy === 'id' ? 'Saving…' : 'Save'}</button>
              </div>
            </Field>
          </fieldset>
        </Card>
        <Card title="2. See the numbers here">
          {status.connected ? (
            <>
              <p className="small" data-testid="ga-connected"><strong>Connected</strong> to property {status.propertyId} as <code>{status.clientEmail}</code>{status.source === 'environment' ? ' (set on the server)' : ''}.</p>
              {canEdit && status.source !== 'environment' ? <button type="button" className="btn btn--ghost btn--sm" onClick={disconnect} disabled={busy === 'disconnect'}>Disconnect</button> : null}
            </>
          ) : (
            <>
              {status.broken ? <Notice tone="warn" title="Connect again">The saved key can no longer be read. Upload it again.</Notice> : null}
              <ol className="ga-steps">
                <li>In <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud ↗</a>: create a project, switch on the “Google Analytics Data API”, then IAM › Service accounts › Create (no roles needed) › Keys › Add key › JSON. A .json file is downloaded.</li>
                <li>In Google Analytics › Admin › Property access management, add the service account’s email (…@….iam.gserviceaccount.com) as a <strong>Viewer</strong>.</li>
                <li>Enter the property ID (Admin › Property details) and choose the .json file below.</li>
              </ol>
              <fieldset className="plain" disabled={!canEdit || busy === 'connect'} style={{ marginTop: 14 }}>
                <Field label="Property ID" htmlFor="ga-prop"><input id="ga-prop" className="input" value={propertyId} onChange={e => setPropertyId(e.target.value)} placeholder="e.g. 412345678" inputMode="numeric" maxLength={20} /></Field>
                <Field label="Key file (.json)" htmlFor="ga-key" hint={keyName ? `Chosen: ${keyName}` : 'Kept safely on the server; it only allows reading the numbers.'}>
                  <input id="ga-key" type="file" accept=".json,application/json" onChange={e => readKey(e.target.files && e.target.files[0])} />
                </Field>
                <button type="button" className="btn btn--accent" onClick={connect} disabled={!propertyId.trim() || !keyText}>{busy === 'connect' ? 'Connecting…' : 'Connect'}</button>
              </fieldset>
            </>
          )}
        </Card>
      </div>
      {confirmDialog}
    </>
  );
}
