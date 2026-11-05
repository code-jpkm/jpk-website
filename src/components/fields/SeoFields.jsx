'use client';

import { Field } from '../ui';

// Search engine title and description, with a Google-style preview.
export default function SeoFields({ title, description, fallbackTitle, fallbackDescription, url, onChange, disabled = false }) {
  const shownTitle = title || fallbackTitle || 'Page title';
  const shownDesc = description || fallbackDescription || 'A short description of the page appears here in Google results.';
  return (
    <div className="seo">
      <div className="seo__preview" aria-label="Google preview">
        <span className="seo__url">{url}</span>
        <span className="seo__title">{shownTitle.length > 62 ? `${shownTitle.slice(0, 60)}…` : shownTitle}</span>
        <span className="seo__desc">{shownDesc.length > 160 ? `${shownDesc.slice(0, 158)}…` : shownDesc}</span>
      </div>
      <Field label="Search title" hint={`${(title || '').length}/60 characters recommended. Leave empty to use the normal title.`} htmlFor="seo-title">
        <input id="seo-title" className="input" value={title} onChange={e => onChange('seoTitle', e.target.value)} maxLength={120} disabled={disabled} placeholder={fallbackTitle} />
      </Field>
      <Field label="Search description" hint={`${(description || '').length}/155 characters recommended.`} htmlFor="seo-desc">
        <textarea id="seo-desc" className="textarea" rows={3} value={description} onChange={e => onChange('seoDescription', e.target.value)} maxLength={300} disabled={disabled} placeholder={fallbackDescription} />
      </Field>
    </div>
  );
}
