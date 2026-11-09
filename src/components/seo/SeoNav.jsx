'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// the tabs of Website › SEO
const TABS = [
  { href: '/admin/website/seo', label: 'Pages', exact: true },
  { href: '/admin/website/seo/links', label: 'Links' },
  { href: '/admin/website/seo/rankings', label: 'Rankings' },
  { href: '/admin/website/seo/settings', label: 'Settings' },
  { href: '/admin/website/seo/redirects', label: 'Redirects' },
  { href: '/admin/analytics', label: 'Analytics' },
];

export default function SeoNav() {
  const path = usePathname();
  return (
    <nav className="seo-tabs" aria-label="SEO">
      {TABS.map(t => {
        const on = t.exact ? path === t.href || (/^\/admin\/website\/seo\/(?!links|rankings|settings|redirects)[^/]+$/.test(path) && t.href === '/admin/website/seo') : path.startsWith(t.href);
        return <Link key={t.href} href={t.href} className={`seo-tabs__tab${on ? ' is-on' : ''}`} aria-current={on ? 'page' : undefined}>{t.label}</Link>;
      })}
    </nav>
  );
}

export function ScoreDot({ score, label = true }) {
  const text = { good: 'Good', ok: 'Could be better', bad: 'Needs work' }[score] || '—';
  return <span className={`seo-score seo-score--${score || 'none'}`}><span className="seo-score__dot" aria-hidden="true" />{label ? text : <span className="sr-only">{text}</span>}</span>;
}

// the 0–100 SEO score in a ring (green 80+, orange 50–79, red below 50), like Rank Math
export function ScoreBadge({ points, score, size = 'lg' }) {
  const p = Math.max(0, Math.min(100, Math.round(Number(points) || 0)));
  return (
    <span className={`seo-badge seo-badge--${score || 'none'} seo-badge--${size}`} style={{ '--p': p }} role="img" aria-label={`SEO score ${p} of 100`}>
      <span className="seo-badge__num">{p}</span>{size === 'lg' ? <span className="seo-badge__of">/ 100</span> : null}
    </span>
  );
}

// a length meter for a search title or description
export function LengthMeter({ length, good = [30, 60], max = 70 }) {
  const pct = Math.min(100, Math.round((length / max) * 100));
  const tone = !length ? 'bad' : length >= good[0] && length <= good[1] ? 'good' : length > good[1] + 5 ? 'bad' : 'ok';
  return <span className={`seo-meter seo-meter--${tone}`} aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>;
}

export { linksHref, keyFromSlug } from '@/lib/seo/keys';
