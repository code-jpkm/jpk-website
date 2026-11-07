'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { Card, Field, PageHeader } from '@/components/ui';
import { ImageControl } from '@/components/website/controls';
import SeoNav from './SeoNav';

const ADDRESS = [['streetAddress', 'Street'], ['addressLocality', 'Town / city'], ['addressRegion', 'State'], ['postalCode', 'PIN code'], ['addressCountry', 'Country code (e.g. IN)']];

const blank = d => {
  const x = d || {};
  const org = x.org || {};
  return {
    ga4: (x.analytics && x.analytics.ga4) || '',
    google: (x.verify && x.verify.google) || '', bing: (x.verify && x.verify.bing) || '',
    org: { name: org.name || '', shortName: org.shortName || '', phone: org.phone || '', email: org.email || '', founded: org.founded || '', description: org.description || '', address: { ...(org.address || {}) }, factory: { ...(org.factory || {}) }, sameAs: (org.sameAs || []).join('\n'), logo: org.logo || null },
    shareImage: x.shareImage || null,
    block: Boolean(x.robots && x.robots.block), extra: (x.robots && x.robots.extra) || '',
  };
};

// what goes back to the admin: the form plus what this screen does not change (the redirects)
function toData(f, base) {
  const org = { ...f.org, sameAs: f.org.sameAs.split('\n').map(s => s.trim()).filter(Boolean) };
  return {
    ...(base || {}),
    analytics: f.ga4.trim() ? { ga4: f.ga4.trim().toUpperCase() } : undefined,
    verify: { google: f.google, bing: f.bing },
    org,
    shareImage: f.shareImage || undefined,
    robots: { block: f.block, extra: f.extra },
  };
}

// Website › SEO › Settings: Google and Bing verification, Google Analytics, the company details search engines
// show, the sharing picture, and search engine access.
export default function SeoSettings({ initial, company, websiteUrl, canEdit }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [data, setData] = useState(initial.data || {});
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt || null);
  const [form, setForm] = useState(() => blank(initial.data));
  const [saving, setSaving] = useState(false);
  const savedJson = useMemo(() => JSON.stringify(blank(data)), [data]);
  const dirty = JSON.stringify(form) !== savedJson;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setOrg = (k, v) => setForm(f => ({ ...f, org: { ...f.org, [k]: v } }));
  const setAddr = (which, k, v) => setForm(f => ({ ...f, org: { ...f.org, [which]: { ...f.org[which], [k]: v } } }));
  const c = company || {};

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async (force = false) => {
    setSaving(true);
    try {
      const r = await api('/api/admin/site/part?key=seo', { method: 'PUT', body: { data: toData(form, data), updatedAt, force } });
      setData(r.data || {}); setUpdatedAt(r.updatedAt); setForm(blank(r.data));
      toast.success('Saved. The website uses the new settings now; Google sees them at its next visit.');
    } catch (err) {
      if (err.status === 409 && (await confirm({ title: 'Someone else saved the SEO settings', message: err.message, confirmLabel: 'Save mine anyway', tone: 'primary' }))) { setSaving(false); return save(true); }
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addr = (which, built) => (
    <div className="form-row--3 form-row">
      {ADDRESS.map(([k, label]) => (
        <Field key={k} label={label} htmlFor={`${which}-${k}`}>
          <input id={`${which}-${k}`} className="input" value={form.org[which][k] || ''} onChange={e => setAddr(which, k, e.target.value)} placeholder={(built || {})[k] || ''} />
        </Field>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader title="SEO settings" description="Settings for the whole website. Empty fields keep what the website uses now (shown in grey)."
        actions={canEdit ? <>{dirty ? <button type="button" className="btn btn--ghost" onClick={() => setForm(blank(data))}>Undo changes</button> : null}<button type="button" className="btn btn--accent" disabled={!dirty || saving} onClick={() => save()}>{saving ? 'Saving…' : 'Save'}</button></> : null} />
      <SeoNav />
      <fieldset className="plain" disabled={!canEdit || saving}>
        <div className="editor-grid">
          <div>
            <Card title="Google Search Console and Bing">
              <p className="muted small" style={{ marginTop: -4 }}>Shows Google and Bing that the website is yours, so you can see searches, clicks and problems there. In Google Search Console: Add property › URL prefix › {websiteUrl} › HTML tag: copy the tag (or just its content) here.</p>
              <Field label="Google verification" htmlFor="v-google" hint='e.g. <meta name="google-site-verification" content="…" />'>
                <input id="v-google" className="input" value={form.google} onChange={e => set('google', e.target.value)} maxLength={400} />
              </Field>
              <Field label="Bing verification" htmlFor="v-bing" hint='Bing Webmaster Tools › HTML meta tag (msvalidate.01).'>
                <input id="v-bing" className="input" value={form.bing} onChange={e => set('bing', e.target.value)} maxLength={400} />
              </Field>
            </Card>
            <Card title="Google Analytics">
              <Field label="Measurement ID" htmlFor="v-ga4" hint={<>From Google Analytics › Admin › Data streams › your website: it starts with G-. Every page then counts its visitors. See the numbers in <Link href="/admin/analytics">Analytics</Link>.</>}>
                <input id="v-ga4" className="input" value={form.ga4} onChange={e => set('ga4', e.target.value)} maxLength={20} placeholder="G-XXXXXXXXXX" />
              </Field>
            </Card>
            <Card title="Company details for search engines">
              <p className="muted small" style={{ marginTop: -4 }}>Google can show these in its results and on Google Maps-style panels.</p>
              <div className="form-row">
                <Field label="Company name" htmlFor="o-name"><input id="o-name" className="input" value={form.org.name} onChange={e => setOrg('name', e.target.value)} placeholder={c.name} /></Field>
                <Field label="Short name" htmlFor="o-short"><input id="o-short" className="input" value={form.org.shortName} onChange={e => setOrg('shortName', e.target.value)} placeholder={c.shortName} /></Field>
              </div>
              <div className="form-row--3 form-row">
                <Field label="Phone" htmlFor="o-phone"><input id="o-phone" className="input" value={form.org.phone} onChange={e => setOrg('phone', e.target.value)} placeholder={c.phone} /></Field>
                <Field label="Email" htmlFor="o-email"><input id="o-email" className="input" value={form.org.email} onChange={e => setOrg('email', e.target.value)} placeholder={c.email} /></Field>
                <Field label="Founded (year)" htmlFor="o-founded"><input id="o-founded" className="input" value={form.org.founded} onChange={e => setOrg('founded', e.target.value)} placeholder={c.founded} maxLength={4} /></Field>
              </div>
              <Field label="Description" htmlFor="o-desc"><textarea id="o-desc" className="textarea" rows={3} value={form.org.description} onChange={e => setOrg('description', e.target.value)} placeholder={c.description} maxLength={500} /></Field>
              <h3 className="seo-sub">Office address</h3>
              {addr('address', c.address)}
              <h3 className="seo-sub">Factory address</h3>
              {addr('factory', c.factory)}
              <Field label="Profiles on other websites" htmlFor="o-same" hint="One web address per line: LinkedIn, YouTube, Facebook, IndiaMART…">
                <textarea id="o-same" className="textarea" rows={3} value={form.org.sameAs} onChange={e => setOrg('sameAs', e.target.value)} placeholder={(c.sameAs || []).join('\n')} />
              </Field>
              <Field label="Logo for search engines" hint="Square or wide, at least 112 × 112 pixels. Leave empty to use the website logo.">
                <ImageControl value={form.org.logo || undefined} onChange={v => setOrg('logo', v || null)} websiteUrl={websiteUrl} allowRemove />
              </Field>
            </Card>
          </div>
          <div className="editor-grid__side">
            <Card title="Sharing picture">
              <p className="muted small" style={{ marginTop: -4 }}>Shown when a page is shared on LinkedIn, WhatsApp or Facebook, unless the page has its own (SEO of the page).</p>
              <ImageControl value={form.shareImage || undefined} onChange={v => set('shareImage', v || null)} websiteUrl={websiteUrl} allowRemove aspect="1200 / 630" />
            </Card>
            <Card title="Search engines">
              <label className="check" style={{ marginBottom: 14 }}>
                <input type="checkbox" checked={form.block} onChange={e => set('block', e.target.checked)} />
                <span><strong>Keep search engines away</strong><br /><span className="muted small">Only while the website is being tested. Takes effect at the next website build (robots.txt).</span></span>
              </label>
              <Field label="Extra rules for robots.txt" htmlFor="v-robots" hint="Advanced: lines like Disallow: /private/ (User-agent, Allow, Disallow, Crawl-delay).">
                <textarea id="v-robots" className="textarea mono" rows={4} value={form.extra} onChange={e => set('extra', e.target.value)} />
              </Field>
              <p className="muted small">The sitemap for Google is at <a href={`${websiteUrl}/sitemap.xml`} target="_blank" rel="noopener noreferrer">{websiteUrl.replace(/^https?:\/\//, '')}/sitemap.xml ↗</a>; it lists every page that is not hidden from Google.</p>
            </Card>
          </div>
        </div>
      </fieldset>
      {confirmDialog}
    </>
  );
}
