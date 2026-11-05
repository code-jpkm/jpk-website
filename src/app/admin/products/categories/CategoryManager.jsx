'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader, Card, Field, Notice, Spinner, EmptyState, Icon } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import ImageField from '@/components/fields/ImageField';
import { slugify } from '@/components/fields/SlugField';
import { api } from '@/lib/client/api';

const EMPTY = { name: '', slug: '', parent: '', description: '', image: null, order: 0, websitePath: '' };

export default function CategoryManager({ perms, siteUrl }) {
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [items, setItems] = useState([]);
  const [state, setState] = useState({ loading: true, error: '' });
  const [editing, setEditing] = useState(null); // { id?, form }

  const load = useCallback(async () => {
    setState({ loading: true, error: '' });
    try {
      const data = await api('/api/admin/categories');
      setItems(data.items || []);
      setState({ loading: false, error: '' });
    } catch (err) {
      setState({ loading: false, error: err.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const startNew = parent => setEditing({ form: { ...EMPTY, parent: parent || '', order: (items.filter(i => String(i.parent || '') === String(parent || '')).length + 1) * 10 } });
  const startEdit = c => setEditing({ id: c._id, form: { name: c.name, slug: c.slug, parent: c.parent ? String(c.parent) : '', description: c.description || '', image: c.image || null, order: c.order || 0, websitePath: c.websitePath || '' } });

  const remove = async c => {
    if (!(await confirm({ title: `Delete “${c.name}”?`, message: 'The category is removed. Categories that still have products or sub-categories cannot be deleted.', confirmLabel: 'Delete category' }))) return;
    try {
      await api(`/api/admin/categories/${c._id}`, { method: 'DELETE' });
      toast.success('Category deleted.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: '/admin/products', label: 'Products' }}
        title="Product categories"
        description="The product groups of jpkm.in. Products are placed in the most specific category (for example Ductile Iron › Solid Top)."
        actions={perms.create ? <button type="button" className="btn btn--accent" onClick={() => startNew('')}><Icon name="plus" size={16} />New category</button> : null}
      />
      <Card pad={false}>
        {state.error ? (
          <div className="card__body"><Notice tone="danger" title="The categories could not be loaded." action={<button type="button" className="btn btn--ghost btn--sm" onClick={load}>Try again</button>}>{state.error}</Notice></div>
        ) : state.loading && !items.length ? (
          <div className="list-state"><Spinner /></div>
        ) : !items.length ? (
          <EmptyState title="No categories yet" text="Create categories to group products." action={perms.create ? <button type="button" className="btn btn--primary" onClick={() => startNew('')}>Create a category</button> : null} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Category</th><th>Products</th><th>Website page</th><th>Order</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {items.map(c => (
                  <tr key={c._id}>
                    <td className={c.depth ? `indent-${Math.min(c.depth, 3)}` : ''}>
                      {c.depth ? <span className="tree-mark" aria-hidden="true">└</span> : null}
                      <strong className="table__title" style={{ display: 'inline' }}>{c.name}</strong>
                      <span className="table__sub">{c.slug}</span>
                    </td>
                    <td><Link href={`/admin/products?category=${c._id}`} className="muted" title="Show these products">{c.productCount}</Link></td>
                    <td className="small">{c.websitePath ? <a href={`${siteUrl}${c.websitePath}`} target="_blank" rel="noopener noreferrer">{c.websitePath}</a> : <span className="muted">—</span>}</td>
                    <td className="muted">{c.order}</td>
                    <td>
                      <div className="table__actions">
                        {perms.create && c.depth < 3 ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => startNew(c._id)}>+ Sub-category</button> : null}
                        {perms.update ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => startEdit(c)}>Edit</button> : null}
                        {perms.delete ? <button type="button" className="icon-btn icon-btn--danger" onClick={() => remove(c)} title="Delete" aria-label={`Delete ${c.name}`}><Icon name="trash" size={15} /></button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing ? <CategoryDialog editing={editing} items={items} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} /> : null}
      {dialog}
    </>
  );
}

function CategoryDialog({ editing, items, onClose, onSaved }) {
  const ref = useRef(null);
  const toast = useToast();
  const [form, setForm] = useState(editing.form);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [slugTouched, setSlugTouched] = useState(Boolean(editing.id));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  // a category cannot be moved inside itself or its own sub-categories
  const blocked = new Set();
  if (editing.id) {
    blocked.add(editing.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of items) if (c.parent && blocked.has(String(c.parent)) && !blocked.has(c._id)) { blocked.add(c._id); grew = true; }
    }
  }

  const submit = async e => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Please enter a name.'); return; }
    setBusy(true);
    setError('');
    try {
      const body = { ...form, parent: form.parent || null, slug: form.slug || slugify(form.name) };
      if (editing.id) await api(`/api/admin/categories/${editing.id}`, { method: 'PATCH', body });
      else await api('/api/admin/categories', { method: 'POST', body });
      toast.success(editing.id ? 'Category saved.' : 'Category created.');
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="dialog dialog--wide" onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby="cat-title">
      <form onSubmit={submit} noValidate>
        <div className="dialog__body">
          <h2 id="cat-title" className="dialog__title">{editing.id ? 'Edit category' : 'New category'}</h2>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <div className="form-row">
            <Field label="Name" required htmlFor="cat-name">
              <input id="cat-name" className="input" value={form.name} autoFocus maxLength={120} onChange={e => { set('name', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }} />
            </Field>
            <Field label="Inside" htmlFor="cat-parent">
              <select id="cat-parent" className="select" value={form.parent} onChange={e => set('parent', e.target.value)}>
                <option value="">— Top level —</option>
                {items.filter(c => !blocked.has(c._id)).map(c => <option key={c._id} value={c._id}>{`${'   '.repeat(c.depth)}${c.name}`}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description" htmlFor="cat-desc">
            <textarea id="cat-desc" className="textarea" rows={3} value={form.description} maxLength={2000} onChange={e => set('description', e.target.value)} />
          </Field>
          <div className="form-row">
            <Field label="Website page" htmlFor="cat-path" hint="The page on jpkm.in for this group, e.g. /products/pipe-fitting/">
              <input id="cat-path" className="input" value={form.websitePath} maxLength={200} onChange={e => set('websitePath', e.target.value)} placeholder="/products/…/" />
            </Field>
            <Field label="Display order" htmlFor="cat-order" hint="Lower numbers come first.">
              <input id="cat-order" className="input" type="number" value={form.order} onChange={e => set('order', e.target.value)} />
            </Field>
          </div>
          <Field label="Short name for addresses (slug)" htmlFor="cat-slug">
            <input id="cat-slug" className="input" value={form.slug} maxLength={80} onChange={e => { setSlugTouched(true); set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-')); }} />
          </Field>
          <Field label="Picture (optional)">
            <ImageField value={form.image} onChange={v => set('image', v)} folder="categories" aspect="16 / 9" />
          </Field>
        </div>
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : editing.id ? 'Save category' : 'Create category'}</button>
        </div>
      </form>
    </dialog>
  );
}
