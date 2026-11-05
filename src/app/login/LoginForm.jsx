'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';

export default function LoginForm({ expired, configured }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(expired ? 'Your session has ended. Please sign in again.' : '');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email address and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/login', { method: 'POST', body: { email: email.trim(), password } });
      window.location.assign('/admin');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <aside className="login__brand">
        <span className="login__logo"><img src="/logo.png" alt="JPK Metallics" width="170" height="41" /></span>
        <div className="login__pitch">
          <h2>Manage jpkm.in in one place</h2>
          <p>Publish JPK Updates, keep products and photos current, post job openings and answer every enquiry.</p>
          <ul className="login__list">
            <li>JPK Updates articles</li>
            <li>Products, photos and specifications</li>
            <li>Job openings and applications</li>
            <li>Website enquiries</li>
          </ul>
        </div>
        <p className="login__legal">JPK Metallics Pvt. Ltd · Since 1976</p>
      </aside>
      <main className="login__panel">
        <form className="login__form" onSubmit={submit} noValidate>
          <div className="login__mobile-logo"><img src="/logo.png" alt="JPK Metallics" width="160" height="39" /></div>
          <h1>Sign in</h1>
          <p>Use the email address and password you were given.</p>
          {!configured ? (
            <div className="notice notice--warn" role="alert">
              <div className="notice__body"><strong className="notice__title">The database is not connected yet.</strong><div className="notice__text">Add MONGODB_URI in the server settings (Render → Environment), then reload this page.</div></div>
            </div>
          ) : null}
          {error ? <div className="notice notice--danger" role="alert"><div className="notice__body">{error}</div></div> : null}
          <div className="field">
            <label className="field__label" htmlFor="email">Email address</label>
            <input id="email" className="input" type="email" autoComplete="username" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus required />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="password">Password</label>
            <div className="password-wrap">
              <input id="password" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" className="password-toggle" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="login__help">Forgot your password? Ask a JPK administrator to set a new one.</p>
        </form>
      </main>
    </div>
  );
}
