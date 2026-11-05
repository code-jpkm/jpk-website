'use client';

import { useRef, useState } from 'react';
import { uploadImage } from '@/lib/client/api';
import { thumb } from '@/lib/format';
import { IMAGE_ACCEPT } from './ImageField';

// Product photos: several pictures, the first one is the main photo. Upload many at once.
export default function GalleryField({ value = [], onChange, folder = 'products', max = 30, disabled = false }) {
  const input = useRef(null);
  const [queue, setQueue] = useState([]); // [{ name, progress }]
  const [errors, setErrors] = useState([]);
  const [over, setOver] = useState(false);
  const latest = useRef(value);
  latest.current = value;

  const uploadAll = async files => {
    const list = [...(files || [])].filter(Boolean);
    if (!list.length) return;
    const room = max - latest.current.length;
    if (room <= 0) {
      setErrors([`A product can have at most ${max} photos.`]);
      return;
    }
    const chosen = list.slice(0, room);
    setErrors(list.length > room ? [`Only ${room} more photo${room === 1 ? '' : 's'} can be added.`] : []);
    setQueue(chosen.map(f => ({ name: f.name, progress: 0 })));
    for (let i = 0; i < chosen.length; i++) {
      try {
        const img = await uploadImage(chosen[i], { folder, onProgress: p => setQueue(q => q.map((x, j) => (j === i ? { ...x, progress: p } : x))) });
        const next = [...latest.current, { ...img, alt: '' }];
        latest.current = next;
        onChange(next);
      } catch (err) {
        setErrors(e => [...e, `${chosen[i].name}: ${err.message}`]);
      }
    }
    setQueue([]);
  };

  const move = (i, d) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const makeMain = i => onChange([value[i], ...value.filter((_, k) => k !== i)]);
  const remove = i => onChange(value.filter((_, k) => k !== i));
  const setAlt = (i, alt) => onChange(value.map((img, k) => (k === i ? { ...img, alt } : img)));

  return (
    <div className="gallery">
      {value.length ? (
        <ul className="gallery__grid">
          {value.map((img, i) => (
            <li key={`${img.url}-${i}`} className="gallery__item">
              <div className="gallery__thumb">
                <img src={thumb(img.url, 400)} alt={img.alt || ''} />
                {i === 0 ? <span className="gallery__main">Main photo</span> : null}
              </div>
              <input className="input input--sm" placeholder="Describe this photo" value={img.alt || ''} onChange={e => setAlt(i, e.target.value)} maxLength={300} disabled={disabled} aria-label={`Description of photo ${i + 1}`} />
              {!disabled ? (
                <div className="gallery__tools">
                  <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} title="Move left" aria-label="Move left">←</button>
                  <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === value.length - 1} title="Move right" aria-label="Move right">→</button>
                  {i > 0 ? <button type="button" className="icon-btn" onClick={() => makeMain(i)} title="Make main photo" aria-label="Make main photo">★</button> : null}
                  <button type="button" className="icon-btn icon-btn--danger" onClick={() => remove(i)} title="Remove" aria-label="Remove photo">✕</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!disabled ? (
        <button
          type="button"
          className={`dropzone dropzone--wide${over ? ' is-over' : ''}`}
          onClick={() => input.current && input.current.click()}
          onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); uploadAll(e.dataTransfer.files); }}
          disabled={queue.length > 0}
        >
          <span className="dropzone__title">{queue.length ? 'Uploading…' : value.length ? 'Add more photos' : 'Add product photos'}</span>
          <span className="dropzone__hint">Choose several at once or drop them here. Use high-resolution photos; large files are resized automatically.</span>
        </button>
      ) : null}
      {queue.map((q, i) => (
        <div key={i} className="upload-row">
          <span className="upload-row__name">{q.name}</span>
          <div className="progress"><span style={{ width: `${q.progress}%` }} /></div>
        </div>
      ))}
      {errors.map((e, i) => <p key={i} className="field__error" role="alert">{e}</p>)}
      <input ref={input} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={e => { const f = [...e.target.files]; e.target.value = ''; uploadAll(f); }} />
    </div>
  );
}
