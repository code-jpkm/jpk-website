'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/Toast';
import { Card, Field } from '@/components/ui';

// Website › Website address: where the website is opened (https://jpkm.in, or http://localhost:5173 while
// testing). The editor's preview, the SEO and link tools and Search Console use it. The website's own config.js
// has the same address (siteUrl) and this admin's address (cmsUrl): both are shown here to copy.
export default function AddressCard({ websiteUrl, canEdit }) {
  const toast = useToast();
  const router = useRouter();
  const [info, setInfo] = useState(null);
  const [value, setValue] = useState(websiteUrl);
  const [saving, setSaving] = useState(false);
  const [admin, setAdmin] = useState('');
  useEffect(() => {
    setAdmin(window.location.origin);
    api('/api/admin/site/address').then(r => { setInfo(r.address); setValue(r.address.url); }).catch(() => {});
  }, []);

  const save = async url => {
    setSaving(true);
    try {
      const r = await api('/api/admin/site/address', { method: 'PUT', body: { url } });
      setInfo(r.address);
      setValue(r.address.url);
      toast.success(`Saved. The preview and the SEO tools now use ${r.address.url}.`);
      router.refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); toast.success('Copied.'); } catch { /* the text can still be selected */ }
  };
  const current = (info && info.url) || websiteUrl;
  const changed = value.trim().replace(/\/+$/, '') !== current;
  return (
    <Card title="Website address" className="ws-address">
      <form className="ws-address__row" onSubmit={e => { e.preventDefault(); if (changed) save(value); }}>
        <Field label="The website is opened at" htmlFor="ws-address" hint="For example https://jpkm.in, or http://localhost:5173 while you test the website on your computer.">
          <input id="ws-address" className="input" value={value} onChange={e => setValue(e.target.value)} disabled={!canEdit || saving} placeholder="https://jpkm.in" maxLength={200} inputMode="url" autoComplete="off" spellCheck={false} />
        </Field>
        {canEdit ? (
          <div className="ws-address__actions">
            <button type="submit" className="btn btn--primary" disabled={!changed || saving}>{saving ? 'Saving…' : 'Save'}</button>
            {info && info.saved ? <button type="button" className="btn btn--ghost" disabled={saving} onClick={() => save('')} title={`Back to ${info.fallback}`}>Use {info.fallback.replace(/^https?:\/\//, '')}</button> : null}
            <a className="btn btn--ghost" href={current} target="_blank" rel="noopener noreferrer">Open ↗</a>
          </div>
        ) : null}
      </form>
      <div className="ws-address__link small">
        <p>
          The website&rsquo;s <code>config.js</code> (in the website folder) must have the same two addresses:
        </p>
        <ul>
          <li><code>siteUrl: &apos;{current}&apos;</code> <button type="button" className="btn btn--ghost btn--sm" onClick={() => copy(current)}>Copy</button></li>
          {admin ? <li><code>cmsUrl: &apos;{admin}&apos;</code> (this admin) <button type="button" className="btn btn--ghost btn--sm" onClick={() => copy(admin)}>Copy</button></li> : null}
        </ul>
        {info && info.local ? <p className="muted">This is an address on a computer of yours (a test). The preview works on that computer only. Before the website is uploaded, set the live address here and in <code>config.js</code>.</p> : null}
      </div>
    </Card>
  );
}
