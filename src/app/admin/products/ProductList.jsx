'use client';

import Link from 'next/link';
import { useList } from '@/components/useList';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import ListState from '@/components/ListState';
import Pagination from '@/components/Pagination';
import { PageHeader, Card, Badge, EmptyState, Icon } from '@/components/ui';
import { api } from '@/lib/client/api';
import { timeAgo, thumb } from '@/lib/format';

export default function ProductList({ perms, categories, initialCategory = '' }) {
  const list = useList('/api/admin/products', { q: '', status: '', category: initialCategory });
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const labels = new Map(categories.map(c => [c._id, c.label]));

  const remove = async p => {
    if (!(await confirm({ title: 'Delete this product?', message: `“${p.name}” and its photo list will be removed. This cannot be undone.`, confirmLabel: 'Delete product' }))) return;
    try {
      await api(`/api/admin/products/${p._id}`, { method: 'DELETE' });
      toast.success('Product deleted.');
      list.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = Boolean(list.filters.q || list.filters.status || list.filters.category);
  return (
    <>
      <PageHeader
        title="Products"
        description="Products with photos, specifications and size tables, grouped by category."
        actions={
          <>
            <Link href="/admin/products/categories" className="btn btn--ghost">Categories</Link>
            {perms.create ? <Link href={list.filters.category && list.filters.category !== 'none' ? `/admin/products/new?category=${list.filters.category}` : '/admin/products/new'} className="btn btn--accent"><Icon name="plus" size={16} />New product</Link> : null}
          </>
        }
      />
      <Card pad={false}>
        <div className="toolbar">
          <div className="toolbar__search">
            <input className="input" type="search" placeholder="Search by name or code" value={list.filters.q} onChange={e => list.update({ q: e.target.value })} aria-label="Search products" />
          </div>
          <select className="select" value={list.filters.category} onChange={e => list.update({ category: e.target.value })} aria-label="Category">
            <option value="">All categories</option>
            {categories.map(c => <option key={c._id} value={c._id}>{`${'  '.repeat(c.depth)}${c.name}`}</option>)}
            <option value="none">Without a category</option>
          </select>
          <select className="select" value={list.filters.status} onChange={e => list.update({ status: e.target.value })} aria-label="Status">
            <option value="">All</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </div>
        <ListState
          list={list}
          empty={
            <EmptyState
              title={filtered ? 'No products match' : 'No products yet'}
              text={filtered ? 'Try another search or category.' : 'Add products with photos and specifications. They are available to the website through the public products API.'}
              action={perms.create && !filtered ? <Link href="/admin/products/new" className="btn btn--primary">Add the first product</Link> : null}
            />
          }
        >
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 80 }}><span className="sr-only">Photo</span></th>
                <th>Product</th>
                <th className="hide-sm">Category</th>
                <th>Status</th>
                <th className="hide-sm">Photos</th>
                <th className="hide-sm">Last change</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.items.map(p => {
                const main = p.images && p.images[0];
                const catId = p.category && (p.category._id || p.category);
                return (
                  <tr key={p._id}>
                    <td>{main ? <img className="table__thumb" src={thumb(main.url, 160)} alt="" loading="lazy" style={{ objectFit: 'contain', background: '#fff' }} /> : <span className="table__thumb table__thumb--empty"><Icon name="image" /></span>}</td>
                    <td>
                      <Link href={`/admin/products/${p._id}`} className="table__title">{p.featured ? <span className="star-on" title="Featured">★ </span> : null}{p.name}</Link>
                      <span className="table__sub">{p.code ? `${p.code} · ` : ''}{p.summary || p.slug}</span>
                    </td>
                    <td className="small hide-sm">{catId ? labels.get(String(catId)) || (p.category && p.category.name) || '—' : <span className="muted">None</span>}</td>
                    <td><Badge status={p.status} /></td>
                    <td className="muted hide-sm">{(p.images || []).length}</td>
                    <td className="nowrap muted hide-sm">{timeAgo(p.updatedAt)}</td>
                    <td>
                      <div className="table__actions">
                        <Link href={`/admin/products/${p._id}`} className="btn btn--ghost btn--sm">{perms.update ? 'Edit' : 'Open'}</Link>
                        {perms.delete ? <button type="button" className="icon-btn icon-btn--danger" onClick={() => remove(p)} title="Delete" aria-label={`Delete “${p.name}”`}><Icon name="trash" size={15} /></button> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ListState>
        <Pagination page={list.filters.page} pages={list.pages} total={list.total} onPage={list.setPage} noun="products" />
      </Card>
      {dialog}
    </>
  );
}
