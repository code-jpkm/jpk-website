import Link from 'next/link';

// Small building blocks shared by all admin screens.

export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="page-header">
      <div className="page-header__text">
        {back ? <Link href={back.href} className="page-header__back">← {back.label}</Link> : null}
        <h1 className="page-header__title">{title}</h1>
        {description ? <p className="page-header__desc">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  );
}

const TONES = {
  published: 'green', draft: 'grey', closed: 'grey',
  new: 'orange', read: 'blue', replied: 'green',
  reviewing: 'blue', shortlisted: 'violet', interview: 'violet', offered: 'green', hired: 'green', rejected: 'red',
  admin: 'navy', staff: 'blue', active: 'green', inactive: 'red',
};
const LABELS = {
  published: 'Published', draft: 'Draft', closed: 'Closed', new: 'New', read: 'Read', replied: 'Replied',
  reviewing: 'Reviewing', shortlisted: 'Shortlisted', interview: 'Interview', offered: 'Offered', hired: 'Hired', rejected: 'Rejected',
  admin: 'Administrator', staff: 'Staff', active: 'Active', inactive: 'Switched off',
};

export function statusLabel(status) {
  return LABELS[status] || status;
}

export function Badge({ status, children, tone }) {
  return <span className={`badge badge--${tone || TONES[status] || 'grey'}`}>{children || statusLabel(status)}</span>;
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 48 48" aria-hidden="true" className="empty__icon"><rect x="7" y="11" width="34" height="26" rx="4" /><path d="M7 19h34M15 27h10M15 31h16" /></svg>
      <p className="empty__title">{title}</p>
      {text ? <p className="empty__text">{text}</p> : null}
      {action || null}
    </div>
  );
}

export function Notice({ tone = 'info', title, children, action }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <div className="notice__body">
        {title ? <strong className="notice__title">{title}</strong> : null}
        {children ? <div className="notice__text">{children}</div> : null}
      </div>
      {action ? <div className="notice__action">{action}</div> : null}
    </div>
  );
}

export function Card({ title, actions, children, className = '', pad = true }) {
  return (
    <section className={`card ${className}`}>
      {title || actions ? (
        <div className="card__head">
          {title ? <h2 className="card__title">{title}</h2> : <span />}
          {actions || null}
        </div>
      ) : null}
      <div className={pad ? 'card__body' : ''}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, error, htmlFor, children, required, className = '' }) {
  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      {label ? (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="field__req" aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="field__error">{error}</p> : hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function NoAccess({ what = 'this section' }) {
  return (
    <div className="no-access">
      <PageHeader title="No access" />
      <Notice tone="warn" title={`You do not have permission to open ${what}.`}>
        Ask an administrator to give your account access if you need it.
      </Notice>
    </div>
  );
}

export function Icon({ name, size = 18 }) {
  const paths = {
    dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
    updates: 'M4 4h16v4H4zM4 10h10v2H4zm0 4h16v2H4zm0 4h12v2H4z',
    products: 'M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3L18.7 8 12 11.7 5.3 8 12 4.3zM5 9.7l6 3.3v6.7l-6-3.3V9.7zm8 10V13l6-3.3v6.7l-6 3.3z',
    categories: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    jobs: 'M10 3h4a2 2 0 0 1 2 2v1h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4V5a2 2 0 0 1 2-2zm0 3h4V5h-4v1zM5 8v4h14V8H5zm0 6v4h14v-4h-6v1h-2v-1H5z',
    applications: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm0 2.5L17.5 8H14V4.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2zm0-8h4v2H8V8z',
    enquiries: 'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2zm2 4v2h12V8H6zm0 4v2h8v-2H6z',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-7 1.7-7 4v3h14v-3c0-2.3-3.7-4-7-4zm8-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm1 2h-.4A5.6 5.6 0 0 1 20 17v3h3v-3c0-2-2.5-3.6-5-4z',
    account: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5z',
    logout: 'M10 17v-3H3v-4h7V7l5 5-5 5zm2-15h7a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-7v-2h7V4h-7V2z',
    plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
    external: 'M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    download: 'M11 3h2v9.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3V3zM4 18h16v2H4z',
    trash: 'M9 3h6l1 1h4v2H4V4h4l1-1zM6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z',
    menu: 'M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z',
    close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z',
    star: 'm12 2 3 6.6 7 .7-5.3 4.7 1.6 7L12 17.3 5.7 21l1.6-7L2 9.3l7-.7z',
    image: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v9.6l4-4 3 3 5-5 4 4V6H4zm4 3a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 7L4 6v2l8 5 8-5V6l-8 5z',
    phone: 'M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2 11 11 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.2.2 2.4.6 3.6a1 1 0 0 1-.3 1l-2.2 2.2z',
    eye: 'M12 5c5 0 9 4.5 10 7-1 2.5-5 7-10 7S3 14.5 2 12c1-2.5 5-7 10-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    lock: 'M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3z',
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="icon" fill="currentColor">
      <path d={paths[name] || paths.dashboard} />
    </svg>
  );
}
