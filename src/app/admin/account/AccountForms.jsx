'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, Card, Field, Notice, Badge } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { MODULES } from '@/lib/permissions';
import { api } from '@/lib/client/api';

export default function AccountForms({ user }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', repeat: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwDone, setPwDone] = useState(false);
  const usingSeed = user.isSeed && !user.passwordChangedAt && !pwDone;

  const saveName = async e => {
    e.preventDefault();
    setSavingName(true);
    try {
      await api('/api/auth/me', { method: 'PATCH', body: { name } });
      toast.success('Name saved.');
      router.refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async e => {
    e.preventDefault();
    setPwError('');
    if (pw.next.length < 8) { setPwError('The new password must be at least 8 characters long.'); return; }
    if (pw.next !== pw.repeat) { setPwError('The two new passwords are not the same.'); return; }
    setPwBusy(true);
    try {
      await api('/api/auth/password', { method: 'POST', body: { currentPassword: pw.current, newPassword: pw.next } });
      setPw({ current: '', next: '', repeat: '' });
      setPwDone(true);
      toast.success('Password changed. Other devices have been signed out.');
      router.refresh();
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  const access = user.role === 'admin'
    ? ['Everything, including users and access']
    : MODULES.filter(m => (user.permissions[m.key] || []).length).map(m => `${m.label}: ${user.permissions[m.key].join(', ')}`);

  return (
    <>
      <PageHeader title="My account" description={user.email} />
      {usingSeed ? <Notice tone="warn" title="You are using the starting password.">Choose your own password below.</Notice> : null}
      <div className="grid-2">
        <div>
          <Card title="Profile">
            <form onSubmit={saveName} noValidate>
              <Field label="Name" htmlFor="name">
                <input id="name" className="input" value={name} onChange={e => setName(e.target.value)} maxLength={120} />
              </Field>
              <Field label="Email address" hint="Ask an administrator to change it.">
                <input className="input" value={user.email} disabled />
              </Field>
              <button type="submit" className="btn btn--primary" disabled={savingName || !name.trim() || name === user.name}>{savingName ? 'Saving…' : 'Save name'}</button>
            </form>
          </Card>
          <Card title="Your access">
            <p style={{ marginBottom: 10 }}><Badge status={user.role} /></p>
            <ul style={{ margin: 0, paddingLeft: 18 }} className="small">
              {access.length ? access.map(a => <li key={a}>{a}</li>) : <li>No sections yet. Ask an administrator.</li>}
            </ul>
          </Card>
        </div>
        <Card title="Change password">
          <form onSubmit={changePassword} noValidate>
            {pwError ? <Notice tone="danger">{pwError}</Notice> : null}
            {pwDone ? <Notice tone="success">Your password was changed.</Notice> : null}
            <Field label="Current password" htmlFor="pw-current">
              <input id="pw-current" className="input" type="password" autoComplete="current-password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} />
            </Field>
            <Field label="New password" htmlFor="pw-next" hint="At least 8 characters. Longer is safer; a short sentence works well.">
              <input id="pw-next" className="input" type="password" autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
            </Field>
            <Field label="New password again" htmlFor="pw-repeat">
              <input id="pw-repeat" className="input" type="password" autoComplete="new-password" value={pw.repeat} onChange={e => setPw({ ...pw, repeat: e.target.value })} />
            </Field>
            <button type="submit" className="btn btn--accent" disabled={pwBusy || !pw.current || !pw.next}>{pwBusy ? 'Changing…' : 'Change password'}</button>
          </form>
        </Card>
      </div>
    </>
  );
}
