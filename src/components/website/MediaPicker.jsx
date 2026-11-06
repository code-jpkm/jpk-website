'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, uploadImage, qs } from '@/lib/client/api';
import { IMAGE_ACCEPT } from '@/components/fields/ImageField';
import { thumbOf } from './util';

// Choose a picture: upload a new one or take one from the picture library (everything uploaded in the admin).
// onPick(picture) once, or onPick([pictures]) with `multiple`.
export default function MediaPicker({ open, onClose, onPick, multiple = false, title = 'Choose a picture' }) {
  const ref = useRef(null);
  const input = useRef(null);
  const [tab, setTab] = useState('library');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState([]);
  const [progress, setProgress] = useState(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
    if (open) { setChosen([]); setError(''); }
  }, [open]);

  const load = useCallback(async (p = 1, query = q) => {
    setLoading(true);
    setError('');
    try {
      const r = await api(`/api/admin/media${qs({ page: p, q: query, limit: 40 })}`);
      setItems(list => (p === 1 ? r.items : [...list, ...r.items]));
      setPage(r.page);
      setPages(r.pages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => { if (open && tab === 'library') load(1); }, [open, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = img => {
    const pic = { url: img.url, width: img.width, height: img.height, alt: img.alt || '', publicId: img.publicId, provider: img.provider };
    if (!multiple) { onPick(pic); onClose(); return; }
    setChosen(list => (list.some(c => c.url === pic.url) ? list.filter(c => c.url !== pic.url) : [...list, pic]));
  };

  const upload = async files => {
    const list = [...files].filter(f => f.type.startsWith('image/'));
    if (!list.length) return;
    setError('');
    const done = [];
    for (const [i, file] of list.entries()) {
      setProgress({ n: i + 1, of: list.length, pct: 0 });
      try {
        const img = await uploadImage(file, { folder: 'website', onProgress: pct => setProgress({ n: i + 1, of: list.length, pct }) });
        done.push({ ...img, alt: '' });
      } catch (err) {
        setError(err.message);
      }
    }
    setProgress(null);
    if (!done.length) return;
    if (!multiple) { onPick(done[0]); onClose(); return; }
    setChosen(c => [...c, ...done]);
    setTab('library');
    load(1, '');
  };

  return (
    <dialog ref={ref} className="dialog dialog--media" onCancel={e => { e.preventDefault(); onClose(); }} onClose={() => open && onClose()} aria-labelledby="media-title">
      <div className="media__head">
        <h2 id="media-title" className="dialog__title">{title}</h2>
        <div className="media__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'library'} className={`media__tab${tab === 'library' ? ' is-active' : ''}`} onClick={() => setTab('library')}>Picture library</button>
          <button type="button" role="tab" aria-selected={tab === 'upload'} className={`media__tab${tab === 'upload' ? ' is-active' : ''}`} onClick={() => setTab('upload')}>Upload new</button>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="media__body">
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        {tab === 'upload' ? (
          <button type="button" className={`dropzone dropzone--wide media__drop${over ? ' is-over' : ''}`} onClick={() => input.current && input.current.click()}
            onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files || []); }} disabled={Boolean(progress)}>
            <span className="dropzone__title">{progress ? `Uploading ${progress.n} of ${progress.of}… ${progress.pct}%` : multiple ? 'Add pictures' : 'Add a picture'}</span>
            <span className="dropzone__hint">Click to choose, or drop {multiple ? 'files' : 'a file'} here. JPG, PNG or WebP, up to 25 MB. Large photos are made web-friendly automatically.</span>
          </button>
        ) : (
          <>
            <form className="media__search" onSubmit={e => { e.preventDefault(); load(1, q); }}>
              <input className="input input--sm" type="search" placeholder="Search by file name" value={q} onChange={e => setQ(e.target.value)} aria-label="Search pictures" />
              <button type="submit" className="btn btn--ghost btn--sm">Search</button>
            </form>
            {!loading && !items.length ? <p className="muted media__empty">No pictures yet. Use “Upload new” to add one.</p> : null}
            <div className="media__grid">
              {items.map(img => {
                const sel = chosen.some(c => c.url === img.url);
                return (
                  <button key={img._id} type="button" className={`media__item${sel ? ' is-chosen' : ''}`} onClick={() => pick(img)} title={img.name || ''} aria-pressed={multiple ? sel : undefined}>
                    <img src={thumbOf(img.url, 300)} alt="" loading="lazy" />
                    <span className="media__name">{img.name || 'picture'}</span>
                    {img.width ? <span className="media__size">{img.width}×{img.height}</span> : null}
                  </button>
                );
              })}
            </div>
            {page < pages ? <p className="media__more"><button type="button" className="btn btn--ghost btn--sm" disabled={loading} onClick={() => load(page + 1)}>{loading ? 'Loading…' : 'Show more'}</button></p> : null}
            {loading && !items.length ? <p className="muted">Loading pictures…</p> : null}
          </>
        )}
      </div>
      {multiple ? (
        <div className="dialog__actions">
          <span className="muted small media__count">{chosen.length ? `${chosen.length} chosen` : 'Click pictures to choose them'}</span>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" disabled={!chosen.length} onClick={() => { onPick(chosen); onClose(); }}>Add {chosen.length || ''} picture{chosen.length === 1 ? '' : 's'}</button>
        </div>
      ) : null}
      <input ref={input} type="file" accept={IMAGE_ACCEPT} multiple={multiple} hidden onChange={e => { const f = [...e.target.files]; e.target.value = ''; upload(f); }} />
    </dialog>
  );
}
