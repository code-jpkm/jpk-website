'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, Card, Field, Notice, Badge } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { useFormState } from '@/components/useFormState';
import { MODULES, ACTION_LABELS } from '@/lib/permissions';
import { api } from '@/lib/client/api';
import { formatDate } from '@/lib/format';

const ALL_ACTIONS = ['view', 'create', 'update', 'delete'];

function emptyPermissions() {
  return Object.fromEntries(MODULES.map(m => [m.key, []]));
}

function toForm(u) {
  return {
    name: u ? u.name : '',
    email: u ? u.email : '',
    role: u ? u.role : 'staff',
    active: u ? u.active : true,
    permissions: u ? { ...emptyPermissions(), ...u.permissions } : emptyPermissions(),
    password: '',
  };
}

function makePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%';
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export default function UserForm({ initial, me }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const isNew = !initial;
  const self = initial && initial.id === me;
  const { form, set, reset, dirty } = useFormState(() => toForm(initial));
  const [showPassword, setShowPassword] = useState(isNew);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const toggle = (module, action) => {
    set('permissions', p => {
      const current = new Set(p[module] || []);
      if (current.has(action)) {
        current.delete(action);
        if (action === 'view') current.clear(); // no view means no access to the module
      } else {
        current.add(action);
        current.add('view');
      }
      return { ...p, [module]: ALL_ACTIONS.filter(a => current.has(a)) };
    });
  };
  const setRow = (module, on) => set('permissions', p => ({ ...p, [module]: on ? MODULES.find(m => m.key === module).actions : [] }));

  const save = async e => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) { setError('Please enter a name and an email address.'); return; }
    if (isNew && form.password.length < 8) { setError('Please set a password of at least 8 characters.'); return; }
    if (!isNew && form.password && form.password.length < 8) { setError('The new password must be at least 8 characters.'); return; }
    setBusy('save');
    try {
      const body = { name: form.name, email: form.email, role: form.role, active: form.active, permissions: form.permissions };
      if (form.password) body.password = form.password;
      if (isNew) {
        const { item } = await api('/api/admin/users', { method: 'POST', body });
        reset(toForm(item));
        toast.success(`${item.name} can now sign in.`);
        router.push('/admin/users');
        router.refresh();
      } else {
        const { item } = await api(`/api/admin/users/${initial.id}`, { method: 'PATCH', body });
        reset(toForm(item));
        setShowPassword(false);
        toast.success(form.password ? 'Saved. The new password works from now on.' : 'Saved.');
        router.refresh();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: `Delete ${initial.name}?`, message: 'They will no longer be able to sign in. Content they created stays.', confirmLabel: 'Delete user' }))) return;
    setBusy('delete');
    try {
      await api(`/api/admin/users/${initial.id}`, { method: 'DELETE' });
      reset(form);
      toast.success('User deleted.');
      router.push('/admin/users');
      router.refresh();
    } catch (err) {
      toast.error(err.message);
      setBusy('');
    }
  };

  return (
    <>
      <PageHeader back={{ href: '/admin/users', label: 'Users & access' }} title={isNew ? 'New user' : initial.name} description={!isNew ? <>{initial.email} · last sign-in {initial.lastLoginAt ? formatDate(initial.lastLoginAt, true) : 'never'}</> : 'Create a sign-in for a colleague and choose what they may do.'} />
      <form onSubmit={save} noValidate>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <fieldset className="plain" disabled={Boolean(busy)}>
          <div className="editor-grid">
            <div>
              <Card title="Sign-in details">
                <div className="form-row">
                  <Field label="Name" required htmlFor="name">
                    <input id="name" className="input" value={form.name} onChange={e => set('name', e.target.value)} maxLength={120} autoComplete="off" />
                  </Field>
                  <Field label="Email address" required htmlFor="email" hint="Used to sign in.">
                    <input id="email" className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} maxLength={200} autoComplete="off" />
                  </Field>
                </div>
                {showPassword ? (
                  <Field label={isNew ? 'Password' : 'New password'} required={isNew} htmlFor="password" hint={isNew ? 'At least 8 characters. Give it to the person safely; they can change it under “My account”.' : 'At least 8 characters. They will be signed out and must use the new password.'}>
                    <div className="actions-row" style={{ flexWrap: 'nowrap' }}>
                      <input id="password" className="input" type="text" value={form.password} onChange={e => set('password', e.target.value)} maxLength={128} autoComplete="new-password" spellCheck={false} />
                      <button type="button" className="btn btn--ghost" onClick={() => set('password', makePassword())}>Generate</button>
                    </div>
                  </Field>
                ) : (
                  <Field label="Password">
                    <div><button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowPassword(true)}>Set a new password…</button></div>
                  </Field>
                )}
              </Card>
              <Card title="Role">
                <div className="role-options" role="radiogroup" aria-label="Role">
                  <label className="role-option">
                    <input type="radio" name="role" value="admin" checked={form.role === 'admin'} onChange={() => set('role', 'admin')} disabled={self} />
                    <div><strong>Administrator</strong><span>Can do everything, including adding users and changing access.</span></div>
                  </label>
                  <label className="role-option">
                    <input type="radio" name="role" value="staff" checked={form.role === 'staff'} onChange={() => set('role', 'staff')} disabled={self} />
                    <div><strong>Staff</strong><span>Can only use the sections and actions ticked below.</span></div>
                  </label>
                </div>
                {self ? <p className="field__hint" style={{ marginTop: 10 }}>You cannot change your own role. Ask another administrator.</p> : null}
              </Card>
              {form.role === 'staff' ? (
                <Card title="What this person may do" pad={false}>
                  <div className="table-wrap">
                    <table className="perm-table">
                      <thead>
                        <tr><th>Section</th>{ALL_ACTIONS.map(a => <th key={a}>{ACTION_LABELS[a]}</th>)}<th>All</th></tr>
                      </thead>
                      <tbody>
                        {MODULES.map(m => {
                          const granted = form.permissions[m.key] || [];
                          return (
                            <tr key={m.key}>
                              <td><strong>{m.label}</strong></td>
                              {ALL_ACTIONS.map(a => (
                                <td key={a}>
                                  {m.actions.includes(a)
                                    ? <input type="checkbox" checked={granted.includes(a)} onChange={() => toggle(m.key, a)} aria-label={`${m.label}: ${ACTION_LABELS[a]}`} />
                                    : <span className="na" aria-hidden="true">—</span>}
                                </td>
                              ))}
                              <td><input type="checkbox" checked={granted.length === m.actions.length} onChange={e => setRow(m.key, e.target.checked)} aria-label={`${m.label}: everything`} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="field__hint" style={{ padding: '12px 16px' }}>Create, Edit or Delete also allow viewing. Job applications and enquiries come from the website, so they can be viewed, updated (status and notes) or deleted.</p>
                </Card>
              ) : null}
            </div>
            <div className="editor-grid__side">
              <Card title="Save">
                {!isNew ? <p style={{ marginBottom: 14 }}><Badge status={form.role} /> <Badge status={form.active ? 'active' : 'inactive'} /></p> : null}
                <label className="check" style={{ marginBottom: 16 }}>
                  <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} disabled={self} />
                  <span><strong>Account switched on</strong><br /><span className="muted small">Switch off to stop someone signing in without deleting them.</span></span>
                </label>
                <button type="submit" className="btn btn--accent btn--block">{busy === 'save' ? 'Saving…' : isNew ? 'Create user' : 'Save changes'}</button>
                {dirty ? <p className="field__hint" style={{ marginTop: 10 }}>You have unsaved changes.</p> : null}
              </Card>
              {!isNew && !self ? (
                <Card title="Delete user" className="danger-zone">
                  <p className="muted small" style={{ marginBottom: 12 }}>They can no longer sign in. Content they made stays.</p>
                  <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={remove}>{busy === 'delete' ? 'Deleting…' : 'Delete this user'}</button>
                </Card>
              ) : null}
            </div>
          </div>
        </fieldset>
      </form>
      {dialog}
    </>
  );
}
