'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Visitors per day: one 2px line with a light wash, hairline grid, clean y ticks, the last value labelled at the
// end; a crosshair and tooltip follow the pointer (or the arrow keys when the chart has focus); a table view.
const H = 220, PAD = { t: 14, r: 56, b: 28, l: 44 };
const fmtDate = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const fmtNum = n => (n >= 10000 ? `${Math.round(n / 1000)}K` : n.toLocaleString('en-IN'));

function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export default function DailyChart({ data, label = 'Visitors', field = 'users' }) {
  const box = useRef(null);
  const [w, setW] = useState(640);
  const [at, setAt] = useState(null);
  const [table, setTable] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const values = data.map(d => d[field]);
  const max = niceMax(Math.max(1, ...values));
  const iw = w - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = i => PAD.l + (data.length <= 1 ? iw / 2 : (i * iw) / (data.length - 1));
  const y = v => PAD.t + ih - (v / max) * ih;
  const line = useMemo(() => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[field]).toFixed(1)}`).join(''), [data, w, max]); // eslint-disable-line react-hooks/exhaustive-deps
  const area = data.length ? `${line}L${x(data.length - 1).toFixed(1)},${PAD.t + ih}L${x(0).toFixed(1)},${PAD.t + ih}Z` : '';
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const step = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 90))));
  const last = data.length - 1;
  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * w;
    const i = Math.round(((px - PAD.l) / iw) * (data.length - 1));
    setAt(Math.max(0, Math.min(last, i)));
  };
  const onKey = e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setAt(a => Math.max(0, Math.min(last, (a == null ? last : a) + (e.key === 'ArrowLeft' ? -1 : 1)))); }
    if (e.key === 'Escape') setAt(null);
  };
  const tip = at != null ? data[at] : null;
  return (
    <div className="ga-daily" ref={box}>
      <div className="ga-daily__plot" style={{ position: 'relative' }}>
        <svg className="ga-chart" width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`${label} per day, ${fmtDate(data[0].date)} to ${fmtDate(data[last].date)}. Highest ${Math.max(...values).toLocaleString('en-IN')}.`}
          tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setAt(null)} onFocus={() => setAt(last)} onBlur={() => setAt(null)} onKeyDown={onKey}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="#e7ebef" strokeWidth="1" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#52514e">{fmtNum(t)}</text>
            </g>
          ))}
          {data.map((d, i) => (i % step === 0 || i === last ? <text key={d.date} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} fontSize="11" fill="#52514e">{fmtDate(d.date)}</text> : null))}
          <path d={area} fill="#2a78d6" opacity="0.1" />
          <path d={line} fill="none" stroke="#2a78d6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last)} cy={y(values[last])} r="4" fill="#2a78d6" stroke="#fff" strokeWidth="2" />
          <text x={x(last) + 8} y={y(values[last]) + 4} fontSize="12" fontWeight="600" fill="#0b0b0b">{values[last].toLocaleString('en-IN')}</text>
          {tip ? (
            <g pointerEvents="none">
              <line x1={x(at)} x2={x(at)} y1={PAD.t} y2={PAD.t + ih} stroke="#9aa5ae" strokeWidth="1" />
              <circle cx={x(at)} cy={y(tip[field])} r="4" fill="#2a78d6" stroke="#fff" strokeWidth="2" />
            </g>
          ) : null}
        </svg>
        {tip ? (
          <div className="ga-tip" role="status" style={{ left: Math.min(Math.max(x(at), 70), w - 70) }}>
            <strong>{tip[field].toLocaleString('en-IN')}</strong> <span>{label.toLowerCase()}</span>
            <span className="ga-tip__date">{new Date(`${tip.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          </div>
        ) : null}
      </div>
      <button type="button" className="btn btn--link btn--sm" onClick={() => setTable(t => !t)} aria-expanded={table}>{table ? 'Hide the table' : 'Show as a table'}</button>
      {table ? (
        <table className="table table--compact ga-table">
          <thead><tr><th>Day</th><th className="num">{label}</th><th className="num">Page views</th></tr></thead>
          <tbody>{[...data].reverse().map(d => <tr key={d.date}><td>{fmtDate(d.date)}</td><td className="num">{d.users.toLocaleString('en-IN')}</td><td className="num">{d.views.toLocaleString('en-IN')}</td></tr>)}</tbody>
        </table>
      ) : null}
    </div>
  );
}
