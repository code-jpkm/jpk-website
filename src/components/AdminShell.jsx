'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from './ui';
import { can } from '@/lib/permissions';
import { api } from '@/lib/client/api';

// Sidebar + top bar around every admin screen. Menu items are shown only when the user has access.
const NAV = [
  { group: 'Overview', items: [{ href: '/admin', label: 'Dashboard', icon: 'dashboard', exact: true }] },
  {
    group: 'Website content',
    items: [
      { href: '/admin/blogs', label: 'JPK Updates', icon: 'updates', module: 'blogs' },
      { href: '/admin/products', label: 'Products', icon: 'products', module: 'products', exclude: '/admin/products/categories' },
      { href: '/admin/products/categories', label: 'Product categories', icon: 'categories', module: 'products' },
    ],
  },
  {
    group: 'Website',
    items: [
      { href: '/admin/website', label: 'Pages & sections', icon: 'website', module: 'website', excludeAll: ['/admin/website/menu', '/admin/website/design', '/admin/website/seo'] },
      { href: '/admin/website/menu', label: 'Menu', icon: 'menulist', module: 'website' },
      { href: '/admin/website/design', label: 'Design', icon: 'palette', module: 'website' },
      { href: '/admin/website/seo', label: 'SEO', icon: 'seo', module: 'website' },
      { href: '/admin/analytics', label: 'Analytics', icon: 'chart', module: 'website' },
    ],
  },
  {
    group: 'Careers',
    items: [
      { href: '/admin/jobs', label: 'Job openings', icon: 'jobs', module: 'jobs' },
      { href: '/admin/applications', label: 'Applications', icon: 'applications', module: 'applications', badge: 'applications' },
    ],
  },
  { group: 'Inbox', items: [{ href: '/admin/enquiries', label: 'Enquiries', icon: 'enquiries', module: 'enquiries', badge: 'enquiries' }] },
  { group: 'Settings', items: [{ href: '/admin/users', label: 'Users & access', icon: 'users', module: 'users' }] },
];

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href;
  if (item.exclude && pathname.startsWith(item.exclude)) return false;
  if (item.excludeAll && item.excludeAll.some(x => pathname.startsWith(x))) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminShell({ user, badges = {}, siteUrl = 'https://jpkm.in', children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = e => { if (!e.target.closest('.userbar')) setMenu(false); };
    const esc = e => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* the session cookie is cleared by the server; go to the login page either way */
    }
    window.location.assign('/login');
  };

  const allowed = item => !item.module || (item.module === 'users' ? user.role === 'admin' : can(user, item.module, 'view'));
  const initials = user.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={`shell${open ? ' shell--nav-open' : ''}`}>
      <aside className="sidebar" aria-label="Main menu">
        <div className="sidebar__brand">
          <Link href="/admin" className="sidebar__logo-link">
            <img src="/logo.png" alt="JPK Metallics" className="sidebar__logo" width="150" height="36" />
          </Link>
          <span className="sidebar__product">Admin</span>
          <button type="button" className="sidebar__close" onClick={() => setOpen(false)} aria-label="Close menu"><Icon name="close" /></button>
        </div>
        <nav className="sidebar__nav">
          {NAV.map(group => {
            const items = group.items.filter(allowed);
            if (!items.length) return null;
            return (
              <div key={group.group} className="nav-group">
                <p className="nav-group__title">{group.group}</p>
                {items.map(item => (
                  <Link key={item.href} href={item.href} className={`nav-link${isActive(pathname, item) ? ' is-active' : ''}`} aria-current={isActive(pathname, item) ? 'page' : undefined}>
                    <Icon name={item.icon} />
                    <span className="nav-link__label">{item.label}</span>
                    {item.badge && badges[item.badge] ? <span className="nav-link__badge" title={`${badges[item.badge]} new`}>{badges[item.badge] > 99 ? '99+' : badges[item.badge]}</span> : null}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar__foot">
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="nav-link nav-link--quiet">
            <Icon name="external" />
            <span className="nav-link__label">Open the website</span>
          </a>
        </div>
      </aside>
      <div className="shell__backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="shell__main">
        <header className="topbar">
          <button type="button" className="topbar__menu" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" size={22} /></button>
          <div className="topbar__spacer" />
          <div className="userbar">
            <button type="button" className="userbar__button" onClick={() => setMenu(m => !m)} aria-expanded={menu} aria-haspopup="menu">
              <span className="avatar" aria-hidden="true">{initials || 'U'}</span>
              <span className="userbar__text">
                <span className="userbar__name">{user.name}</span>
                <span className="userbar__role">{user.role === 'admin' ? 'Administrator' : 'Staff'}</span>
              </span>
              <span className="userbar__caret" aria-hidden="true">▾</span>
            </button>
            {menu ? (
              <div className="userbar__menu" role="menu">
                <p className="userbar__email">{user.email}</p>
                <Link href="/admin/account" className="userbar__item" role="menuitem"><Icon name="account" size={16} />My account &amp; password</Link>
                <button type="button" className="userbar__item" role="menuitem" onClick={signOut} disabled={signingOut}><Icon name="logout" size={16} />{signingOut ? 'Signing out…' : 'Sign out'}</button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="content" id="main">{children}</main>
      </div>
    </div>
  );
}
