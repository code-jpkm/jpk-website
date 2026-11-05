'use client';

import Link from 'next/link';
import { useList } from '@/components/useList';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import ListState from '@/components/ListState';
import Pagination from '@/components/Pagination';
import { PageHeader, Card, Badge, EmptyState, Icon } from '@/components/ui';
import { api } from '@/lib/client/api';
import { formatDate, timeAgo, thumb } from '@/lib/format';

export default function BlogList({ perms, siteUrl }) {
  const list = useList('/api/admin/blogs', { q: '', status: '' });
  const toast = useToast();
  const [confirm, dialog] = useConfirm();

  const remove = async post => {
    const ok = await confirm({
      title: 'Delete this post?',
      message: `“${post.title}” will be removed${post.status === 'published' ? ' from the website' : ''}. This cannot be undone.`,
      confirmLabel: 'Delete post',
    });
    if (!ok) return;
    try {
      await api(`/api/admin/blogs/${post._id}`, { method: 'DELETE' });
      toast.success('Post deleted.');
      list.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = Boolean(list.filters.q || list.filters.status);
  return (
    <>
      <PageHeader
        title="JPK Updates"
        description="News and articles shown on the website at /jpk-updates/."
        actions={perms.create ? <Link href="/admin/blogs/new" className="btn btn--accent"><Icon name="plus" size={16} />New post</Link> : null}
      />
      <Card pad={false}>
        <div className="toolbar">
          <div className="toolbar__search">
            <input className="input" type="search" placeholder="Search by title or text" value={list.filters.q} onChange={e => list.update({ q: e.target.value })} aria-label="Search posts" />
          </div>
          <select className="select" value={list.filters.status} onChange={e => list.update({ status: e.target.value })} aria-label="Show">
            <option value="">All posts</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </div>
        <ListState
          list={list}
          empty={
            <EmptyState
              title={filtered ? 'No posts match your search' : 'No posts yet'}
              text={filtered ? 'Try other words or show all posts.' : 'Posts you publish here appear on the JPK Updates page of the website.'}
              action={perms.create && !filtered ? <Link href="/admin/blogs/new" className="btn btn--primary">Write the first post</Link> : null}
            />
          }
        >
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}><span className="sr-only">Picture</span></th>
                <th>Title</th>
                <th>Status</th>
                <th className="hide-sm">Published</th>
                <th className="hide-sm">Last change</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.items.map(p => (
                <tr key={p._id}>
                  <td>{p.coverImage && p.coverImage.url ? <img className="table__thumb" src={thumb(p.coverImage.url, 160)} alt="" loading="lazy" /> : <span className="table__thumb table__thumb--empty"><Icon name="image" /></span>}</td>
                  <td>
                    <Link href={`/admin/blogs/${p._id}`} className="table__title">{p.title}</Link>
                    <span className="table__sub">/jpk-updates/{p.slug}/ · {p.category}</span>
                  </td>
                  <td><Badge status={p.status} /></td>
                  <td className="nowrap hide-sm">{p.status === 'published' ? formatDate(p.publishedAt) : '—'}</td>
                  <td className="nowrap muted hide-sm">{timeAgo(p.updatedAt)}</td>
                  <td>
                    <div className="table__actions">
                      <Link href={`/admin/blogs/${p._id}`} className="btn btn--ghost btn--sm">{perms.update ? 'Edit' : 'Open'}</Link>
                      {p.status === 'published' ? <a href={`${siteUrl}/jpk-updates/${p.slug}/`} target="_blank" rel="noopener noreferrer" className="icon-btn" title="View on the website" aria-label={`View “${p.title}” on the website`}><Icon name="external" size={15} /></a> : null}
                      {perms.delete ? <button type="button" className="icon-btn icon-btn--danger" onClick={() => remove(p)} title="Delete" aria-label={`Delete “${p.title}”`}><Icon name="trash" size={15} /></button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListState>
        <Pagination page={list.filters.page} pages={list.pages} total={list.total} onPage={list.setPage} noun="posts" />
      </Card>
      {dialog}
    </>
  );
}
