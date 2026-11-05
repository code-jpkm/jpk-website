'use client';

// Key–value specifications ("Material: Ductile iron"). Pasting rows from Excel (two columns) fills several rows.
export default function SpecsField({ value = [], onChange, disabled = false }) {
  const rows = value.length ? value : [];
  const set = (i, key, v) => onChange(rows.map((r, k) => (k === i ? { ...r, [key]: v } : r)));
  const add = () => onChange([...rows, { label: '', value: '' }]);
  const remove = i => onChange(rows.filter((_, k) => k !== i));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const onPaste = (i, e) => {
    const t = e.clipboardData.getData('text/plain');
    if (!t || (!t.includes('\t') && !t.includes('\n'))) return;
    e.preventDefault();
    const pasted = t.replace(/\r/g, '').split('\n').filter(l => l.trim()).map(l => {
      const [label, ...rest] = l.split('\t');
      return { label: label.trim(), value: rest.join(' ').trim() };
    });
    const next = [...rows];
    next.splice(i, rows[i] && !rows[i].label && !rows[i].value ? 1 : 0, ...pasted);
    onChange(next);
  };
  return (
    <div className="specs">
      {rows.length ? (
        <div className="specs__table" role="table" aria-label="Specifications">
          <div className="specs__row specs__row--head" role="row">
            <span role="columnheader">Name</span>
            <span role="columnheader">Value</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div className="specs__row" role="row" key={i}>
              <input className="input input--sm" value={r.label} onChange={e => set(i, 'label', e.target.value)} onPaste={e => onPaste(i, e)} placeholder="e.g. Material" maxLength={120} disabled={disabled} aria-label={`Specification ${i + 1} name`} />
              <input className="input input--sm" value={r.value} onChange={e => set(i, 'value', e.target.value)} placeholder="e.g. Ductile iron (EN-GJS-500-7)" maxLength={500} disabled={disabled} aria-label={`Specification ${i + 1} value`} />
              {!disabled ? (
                <span className="specs__tools">
                  <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">↑</button>
                  <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" title="Move down">↓</button>
                  <button type="button" className="icon-btn icon-btn--danger" onClick={() => remove(i)} aria-label="Remove row" title="Remove">✕</button>
                </span>
              ) : <span />}
            </div>
          ))}
        </div>
      ) : null}
      {!disabled ? (
        <div className="specs__foot">
          <button type="button" className="btn btn--ghost btn--sm" onClick={add}>+ Add specification</button>
          <span className="field__hint">Tip: copy two columns from Excel and paste them into a name box.</span>
        </div>
      ) : null}
    </div>
  );
}
