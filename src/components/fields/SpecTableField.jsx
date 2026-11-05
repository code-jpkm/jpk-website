'use client';

// A sizes / load-class table for a product (columns chosen by the user). Pasting a block from Excel
// into any cell fills the table from that cell.
export default function SpecTableField({ value, onChange, disabled = false }) {
  const columns = (value && value.columns) || [];
  const rows = (value && value.rows) || [];
  const emit = (cols, rws) => onChange({ columns: cols, rows: rws.map(r => cols.map((_, i) => (r && r[i]) || '')) });

  const setColumn = (i, name) => emit(columns.map((c, k) => (k === i ? name : c)), rows);
  const addColumn = () => emit([...columns, ''], rows);
  const removeColumn = i => emit(columns.filter((_, k) => k !== i), rows.map(r => r.filter((_, k) => k !== i)));
  const setCell = (r, c, v) => emit(columns, rows.map((row, k) => (k === r ? row.map((x, j) => (j === c ? v : x)) : row)));
  const addRow = () => emit(columns, [...rows, columns.map(() => '')]);
  const removeRow = r => emit(columns, rows.filter((_, k) => k !== r));
  const start = () => emit(['Size', 'Clear opening (mm)', 'Load class', 'Weight (kg)'], [['', '', '', '']]);

  const onPaste = (r, c, e) => {
    const t = e.clipboardData.getData('text/plain');
    if (!t || (!t.includes('\t') && !t.includes('\n'))) return;
    e.preventDefault();
    const block = t.replace(/\r/g, '').split('\n').filter(l => l.length).map(l => l.split('\t'));
    let cols = [...columns];
    const width = Math.max(...block.map(b => b.length));
    while (cols.length < c + width && cols.length < 12) cols.push(`Column ${cols.length + 1}`);
    const next = rows.map(row => cols.map((_, i) => row[i] || ''));
    block.forEach((line, dr) => {
      const ri = r + dr;
      while (next.length <= ri) next.push(cols.map(() => ''));
      line.forEach((v, dc) => { if (c + dc < cols.length) next[ri][c + dc] = v.trim(); });
    });
    emit(cols, next);
  };

  if (!columns.length) {
    return disabled ? <p className="field__hint">No size table.</p> : (
      <div className="spec-table spec-table--empty">
        <p className="field__hint">Optional: a table of sizes, load classes and weights, shown on the product page.</p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={start}>+ Add a size table</button>
      </div>
    );
  }

  return (
    <div className="spec-table">
      <div className="spec-table__scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i}>
                  <div className="spec-table__col">
                    <input className="input input--sm" value={c} onChange={e => setColumn(i, e.target.value)} placeholder="Column name" maxLength={80} disabled={disabled} aria-label={`Column ${i + 1} name`} />
                    {!disabled ? <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeColumn(i)} aria-label={`Remove column ${i + 1}`} title="Remove column">✕</button> : null}
                  </div>
                </th>
              ))}
              {!disabled && columns.length < 12 ? <th className="spec-table__add"><button type="button" className="btn btn--ghost btn--sm" onClick={addColumn}>+ Column</button></th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {columns.map((_, c) => (
                  <td key={c}><input className="input input--sm" value={row[c] || ''} onChange={e => setCell(r, c, e.target.value)} onPaste={e => onPaste(r, c, e)} maxLength={200} disabled={disabled} aria-label={`Row ${r + 1}, ${columns[c] || `column ${c + 1}`}`} /></td>
                ))}
                {!disabled ? <td className="spec-table__add"><button type="button" className="icon-btn icon-btn--danger" onClick={() => removeRow(r)} aria-label={`Remove row ${r + 1}`} title="Remove row">✕</button></td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled ? (
        <div className="specs__foot">
          <button type="button" className="btn btn--ghost btn--sm" onClick={addRow}>+ Add row</button>
          <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={() => onChange({ columns: [], rows: [] })}>Remove table</button>
          <span className="field__hint">Tip: copy cells from Excel and paste them into a box.</span>
        </div>
      ) : null}
    </div>
  );
}
