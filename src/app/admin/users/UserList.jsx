'use client';

import Link from 'next/link';
import { PageHeader, Card, Badge, Icon } from '@/components/ui';
import { MODULES } from '@/lib/permissions';
import { formatDate } from '@/lib/format';

function accessSummary(u) {
  if (u.role === 'admin') return 'Everything, including users';
  const parts = MODULES.filter(m => (u.permissions[m.key] || []).length).map(m => {
    const acts = u.permissions[m.key].filter(a => a !== 'view');
    return acts.length ? `${m.label} (${acts.join(', ')})` : `${m.label} (view)`;
  });
  return parts.length ? parts.join(' · ') : 'No access yet';
}

export default function UserList({ users, me }) {
  return (
    <>
      <PageHeader
        title="Users & access"
        description="Who can sign in and what each person may do. Administrators can do everything, including managing users."
        actions={<Link href="/admin/users/new" className="btn btn--accent"><Icon name="plus" size={16} />New user</Link>}
      />
      <Card pad={false}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Role</th><th className="hide-sm">Access</th><th className="hide-sm">Last sign-in</th><th>Status</th><th><span className="sr-only">Edit</span></th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/users/${u.id}`} className="table__title">{u.name}{u.id === me ? <span className="muted small"> (you)</span> : null}</Link>
                    <span className="table__sub">{u.email}</span>
                  </td>
                  <td><Badge status={u.role} /></td>
                  <td className="small hide-sm" style={{ maxWidth: 420 }}>{accessSummary(u)}</td>
                  <td className="nowrap small hide-sm">{u.lastLoginAt ? formatDate(u.lastLoginAt, true) : <span className="muted">Never</span>}</td>
                  <td><Badge status={u.active ? 'active' : 'inactive'} /></td>
                  <td><div className="table__actions"><Link href={`/admin/users/${u.id}`} className="btn btn--ghost btn--sm">Edit</Link></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
