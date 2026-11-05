'use client';

import { useRef, useState } from 'react';
import { uploadImage } from '@/lib/client/api';
import { thumb } from '@/lib/format';

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

// One picture (cover picture, category picture): upload by click or drag-and-drop, with a description.
export default function ImageField({ value, onChange, folder = 'misc', aspect = '16 / 9', disabled = false, id }) {
  const input = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);

  const upload = async file => {
    if (!file) return;
    setError('');
    setProgress(0);
    try {
      const img = await uploadImage(file, { folder, onProgress: setProgress });
      onChange({ ...img, alt: (value && value.alt) || '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
    }
  };

  const onDrop = e => {
    e.preventDefault();
    setOver(false);
    if (!disabled) upload(e.dataTransfer.files && e.dataTransfer.files[0]);
  };

  return (
    <div className="image-field">
      {value && value.url ? (
        <div className="image-field__preview" style={{ aspectRatio: aspect }}>
          <img src={thumb(value.url, 900)} alt={value.alt || ''} />
        </div>
      ) : (
        <button
          type="button"
          className={`dropzone${over ? ' is-over' : ''}`}
          style={{ aspectRatio: aspect }}
          onClick={() => input.current && input.current.click()}
          onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          disabled={disabled || progress !== null}
          id={id}
        >
          <span className="dropzone__title">{progress !== null ? 'Uploading…' : 'Add a picture'}</span>
          <span className="dropzone__hint">Click to choose, or drop a file here. JPG, PNG or WebP.</span>
        </button>
      )}
      {progress !== null ? <div className="progress" aria-label="Upload progress"><span style={{ width: `${progress}%` }} /></div> : null}
      {error ? <p className="field__error" role="alert">{error}</p> : null}
      {value && value.url ? (
        <>
          <input
            className="input input--sm"
            placeholder="Describe the picture (helps Google and screen readers)"
            value={value.alt || ''}
            onChange={e => onChange({ ...value, alt: e.target.value })}
            maxLength={300}
            disabled={disabled}
            aria-label="Picture description"
          />
          {!disabled ? (
            <div className="image-field__actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => input.current && input.current.click()} disabled={progress !== null}>Replace</button>
              <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={() => onChange(null)}>Remove</button>
            </div>
          ) : null}
        </>
      ) : null}
      <input ref={input} type="file" accept={IMAGE_ACCEPT} hidden onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; upload(f); }} />
    </div>
  );
}
