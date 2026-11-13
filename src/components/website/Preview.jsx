'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// The live website inside the editor. The page is loaded with ?cms-edit=1: it then shows the unsaved changes sent
// from here, outlines what can be changed and reports clicks ("jpk-cms:select").
// the page is drawn at the device's width and scaled down to fit, so "Computer" shows the real desktop layout
const DEVICES = [
  { key: 'desktop', label: 'Computer', width: 1366 },
  { key: 'tablet', label: 'Tablet', width: 820 },
  { key: 'phone', label: 'Phone', width: 390 },
];

function origins(websiteUrl) {
  try {
    const u = new URL(websiteUrl);
    const alt = u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`;
    return [u.origin, `${u.protocol}//${alt}${u.port ? `:${u.port}` : ''}`];
  } catch {
    return [];
  }
}

export default function Preview({ websiteUrl, path, draft, focus, onSelect, onNavigate, toolbar }) {
  const frame = useRef(null);
  const stage = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [other, setOther] = useState(''); // the website answers, but takes its content from another admin
  const [device, setDevice] = useState('desktop');
  const [n, setN] = useState(0); // reload counter
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const allowed = origins(websiteUrl);
  const target = allowed[0] || '*';

  const post = useCallback(msg => {
    const w = frame.current && frame.current.contentWindow;
    if (w) w.postMessage(msg, target);
  }, [target]);

  useEffect(() => {
    const onMsg = e => {
      if (!allowed.includes(e.origin)) return;
      const m = e.data || {};
      // sent by the website to any page that shows it in the editor: the admin its config.js points to
      if (m.type === 'jpk-cms:hello') setOther(typeof m.cms === 'string' && m.cms && m.cms !== window.location.origin ? m.cms : '');
      if (m.type === 'jpk-cms:ready') {
        setReady(true);
        setSlow(false);
        post({ type: 'jpk-cms:draft', draft: draftRef.current });
        if (onNavigate && m.path) onNavigate(m.path);
      }
      if (m.type === 'jpk-cms:select' && onSelect) onSelect({ key: m.key || null, link: m.link || null, section: m.section || null });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [allowed.join('|'), post, onSelect, onNavigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // unsaved changes go to the page as they are typed
  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => post({ type: 'jpk-cms:draft', draft }), 120);
    return () => clearTimeout(t);
  }, [draft, ready, post]);

  useEffect(() => {
    if (ready && focus && (focus.key || focus.section)) post({ type: 'jpk-cms:focus', key: focus.key || null, section: focus.section || null });
  }, [focus, ready, post]);

  useEffect(() => {
    const el = stage.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setBox({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // a new page address, or "reload"
  useEffect(() => {
    setReady(false);
    setSlow(false);
    setOther('');
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, [path, n]);

  const src = `${websiteUrl}${path}${path.includes('?') ? '&' : '?'}cms-edit=1`;
  const want = DEVICES.find(d => d.key === device).width;
  const avail = Math.max(0, box.w - (device === 'desktop' ? 0 : 24));
  const w = device === 'desktop' ? Math.max(want, box.w || want) : want;
  const scale = avail && avail < w ? avail / w : 1;
  const h = box.h ? box.h / scale : 0;
  return (
    <div className="preview">
      <div className="preview__bar">
        <div className="preview__devices" role="group" aria-label="Screen size">
          {DEVICES.map(d => (
            <button key={d.key} type="button" className={`preview__device${device === d.key ? ' is-active' : ''}`} aria-pressed={device === d.key} onClick={() => setDevice(d.key)}>{d.label}</button>
          ))}
        </div>
        {toolbar || null}
        <span className="preview__spacer" />
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setN(x => x + 1)} title="Load the page again">Reload</button>
        <a className="btn btn--ghost btn--sm" href={`${websiteUrl}${path === '/cms-preview/' ? '/' : path}`} target="_blank" rel="noopener noreferrer">Open the website ↗</a>
      </div>
      <div className="preview__stage" ref={stage}>
        <div className="preview__canvas" style={box.w ? { width: `${Math.round(w * scale)}px`, height: `${box.h}px` } : undefined}>
          <iframe key={`${src}#${n}`} ref={frame} src={src} title="Website preview" className="preview__frame"
            style={box.w ? { width: `${w}px`, height: `${h}px`, transform: scale !== 1 ? `scale(${scale})` : undefined } : undefined} />
        </div>
        {!ready ? (
          <div className="preview__overlay" aria-live="polite">
            {other ? (
              <div className="preview__help">
                <strong>The website is linked to another admin.</strong>
                <p>The website at {websiteUrl} takes its content from {other}, so it cannot show the changes made here. In the website folder, open <code>config.js</code>, set <code>cmsUrl: &apos;{typeof window === 'undefined' ? '' : window.location.origin}&apos;</code>, then restart or build the website again.</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setN(x => x + 1)}>Try again</button>
              </div>
            ) : slow ? (
              <div className="preview__help">
                <strong>The preview could not connect to the website.</strong>
                <p>The website at {websiteUrl} may be waking up or may still be the version without the editor (it gets the editor with its next update). You can still make and save changes; they appear on the website once it has the new version.</p>
                <p>If the website is opened at another address, change it in <a href="/admin/website">Website › Website address</a>.</p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setN(x => x + 1)}>Try again</button>
              </div>
            ) : <span className="spinner"><span className="spinner__dot" aria-hidden="true" />Loading the page…</span>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
