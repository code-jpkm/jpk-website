'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client/api';
import { formatDate } from '@/lib/format';

// Earlier versions of a page (or of the menu / design): every save keeps the version before it.
export default function History({ partKey, onClose, onRestored, canRestore }) {
  const ref = useRef(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => { const el = ref.current; if (el && !el.open) el.showModal(); }, []);
  useEffect(() => {
    api(`/api/admin/site/revisions?key=${encodeURIComponent(partKey)}`).then(r => setItems(r.items)).catch(err => setError(err.message));
  }, [partKey]);
  const restore = async id => {
    setBusy(id);
    setError('');
    try {
      const r = await api('/api/admin/site/revisions', { method: 'POST', body: { key: partKey, id } });
      onRestored(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };
  return (
    <dialog ref={ref} className="dialog" onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby="hist-title">
      <div className="dialog__body">
        <h2 id="hist-title" className="dialog__title">Earlier versions</h2>
        <p className="dialog__text">Each time this is saved, the version before is kept here (the last 30). Bringing one back makes it live on the website; the current version is kept here too.</p>
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        {items === null && !error ? <p className="muted">Loading…</p> : null}
        {items && !items.length ? <p className="muted">No earlier versions yet.</p> : null}
        {items && items.length ? (
          <ul className="ws-history">
            {items.map(r => (
              <li key={r._id}>
                <span><strong>{formatDate(r.savedAt, true)}</strong>{r.savedByName ? <span className="muted small"> · {r.savedByName}</span> : null}</span>
                {canRestore ? <button type="button" className="btn btn--ghost btn--sm" disabled={Boolean(busy)} onClick={() => restore(r._id)}>{busy === r._id ? 'Bringing back…' : 'Bring back'}</button> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="dialog__actions"><button type="button" className="btn btn--ghost" onClick={onClose}>Close</button></div>
    </dialog>
  );
}
