// Dates and sizes shown in the admin (India time).

const TZ = 'Asia/Kolkata';

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', withTime ? { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' } : { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(value) {
  if (!value) return '—';
  const secs = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

export function formatBytes(n) {
  if (!n) return '0 KB';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// yyyy-mm-dd for <input type="date">, in India time
export function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

// yyyy-mm-ddThh:mm for <input type="datetime-local">, in India time
export function toDateTimeInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + 330 * 60 * 1000).toISOString().slice(0, 16);
}

// back from datetime-local (India time) to an ISO date
export function fromDateTimeInput(value) {
  if (!value) return null;
  const d = new Date(`${value}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function thumb(url, width = 320) {
  if (!url) return '';
  const m = String(url).match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
  return m ? `${m[1]}f_auto,q_auto,c_limit,w_${width}/${m[2]}` : url;
}
