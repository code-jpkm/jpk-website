import Link from 'next/link';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="error-page">
      <div className="error-page__box">
        <img src="/logo.png" alt="JPK Metallics" width="170" height="41" />
        <h1>Page not found</h1>
        <p className="muted">This page does not exist, or the item was deleted.</p>
        <Link href="/admin" className="btn btn--primary">Go to the dashboard</Link>
      </div>
    </div>
  );
}
