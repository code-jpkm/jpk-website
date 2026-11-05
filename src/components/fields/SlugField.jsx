'use client';

import { Field } from '../ui';

export function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

// The last part of the web address. While creating, it follows the title until it is edited by hand.
export default function SlugField({ value, onChange, prefix, suffix = '/', published, disabled = false }) {
  return (
    <Field label="Web address (slug)" htmlFor="slug">
      <input id="slug" className="input" value={value} onChange={e => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))} onBlur={() => onChange(slugify(value))} maxLength={80} disabled={disabled} spellCheck={false} />
      {prefix ? <p className="slug-preview" title={`${prefix}${value}${suffix}`}>{prefix}<strong>{value || '…'}</strong>{suffix}</p> : null}
      <p className="field__hint">{published ? 'Changing the address of a published item breaks links that people or Google already have.' : 'Filled in from the title. Only letters, numbers and dashes.'}</p>
    </Field>
  );
}
