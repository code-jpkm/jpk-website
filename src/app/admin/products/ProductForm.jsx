'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, Card, Field, Notice, Badge } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { useFormState } from '@/components/useFormState';
import RichEditor from '@/components/fields/RichEditor';
import GalleryField from '@/components/fields/GalleryField';
import SpecsField from '@/components/fields/SpecsField';
import SpecTableField from '@/components/fields/SpecTableField';
import SeoFields from '@/components/fields/SeoFields';
import SlugField, { slugify } from '@/components/fields/SlugField';
import { api } from '@/lib/client/api';

const lines = arr => (arr || []).join('\n');

function toForm(d = {}, defaultCategory = '') {
  return {
    name: d.name || '',
    slug: d.slug || '',
    code: d.code || '',
    category: d.category ? String(d.category._id || d.category) : defaultCategory,
    summary: d.summary || '',
    description: d.description || '',
    images: d.images || [],
    specs: d.specs || [],
    specTable: d.specTable && d.specTable.columns && d.specTable.columns.length
      ? { columns: d.specTable.columns, rows: (d.specTable.rows || []).map(r => (Array.isArray(r) ? r : (r && r.cells) || [])) }
      : { columns: [], rows: [] },
    features: lines(d.features),
    options: lines(d.options),
    loadClass: d.loadClass || '',
    material: d.material || '',
    group: d.group || '',
    applications: lines(d.applications),
    standards: lines(d.standards),
    featured: Boolean(d.featured),
    order: d.order ?? '',
    status: d.status || 'draft',
    seoTitle: d.seoTitle || '',
    seoDescription: d.seoDescription || '',
  };
}

const normPath = p => (p ? `/${String(p).replace(/^\/+|\/+$/g, '')}/` : '');

export default function ProductForm({ initial, categories, groups = [], websiteUrl = '', defaultCategory = '', perms }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const isNew = !initial;
  const [saved, setSaved] = useState(initial || null);
  const { form, set, reset, dirty } = useFormState(() => toForm(initial, defaultCategory));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [busy, setBusy] = useState('');
  const [errors, setErrors] = useState({});
  const canEdit = isNew || perms.update;
  const live = saved && saved.status === 'published';

  const setName = v => {
    set('name', v);
    if (errors.name) setErrors({});
    if (!slugTouched) set('slug', slugify(v));
  };

  const save = async status => {
    if (!form.name.trim()) {
      setErrors({ name: 'Please enter the product name.' });
      document.getElementById('name')?.focus();
      return;
    }
    setErrors({});
    setBusy(status);
    try {
      const payload = { ...form, status, category: form.category || null, group: group ? group.id : '' };
      if (isNew) {
        const { item } = await api('/api/admin/products', { method: 'POST', body: payload });
        reset(toForm(item));
        toast.success(status === 'published' ? 'Product published.' : 'Product saved as a draft.');
        router.replace(`/admin/products/${item._id}`);
      } else {
        const { item } = await api(`/api/admin/products/${saved._id}`, { method: 'PATCH', body: payload });
        setSaved(item);
        reset(toForm(item));
        toast.success(status === 'published' ? 'Product saved and published.' : 'Product saved as a draft.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Delete this product?', message: `“${saved.name}” will be removed. This cannot be undone.`, confirmLabel: 'Delete product' }))) return;
    setBusy('delete');
    try {
      await api(`/api/admin/products/${saved._id}`, { method: 'DELETE' });
      reset(form);
      toast.success('Product deleted.');
      router.push('/admin/products');
    } catch (err) {
      toast.error(err.message);
      setBusy('');
    }
  };

  const cat = categories.find(c => c._id === form.category) || {};
  const catLabel = cat.label;
  // the groups of cards on the website page of the chosen category (tabs or titled blocks)
  const pageGroups = groups.filter(g => normPath(g.path) === normPath(cat.path));
  const group = pageGroups.find(g => g.id === form.group) || pageGroups[0] || null;
  const onWebsite = Boolean(group);

  return (
    <>
      <PageHeader back={{ href: '/admin/products', label: 'Products' }} title={isNew ? 'New product' : form.name || 'Edit product'} />
      {!canEdit ? <Notice tone="info" title="Read only">You can see this product but your account cannot change it.</Notice> : null}
      <form onSubmit={e => { e.preventDefault(); if (canEdit) save(live ? 'published' : 'draft'); }} noValidate>
        <fieldset className="plain" disabled={!canEdit || Boolean(busy)}>
          <div className="editor-grid">
            <div>
              <Card>
                <Field label="Product name" required htmlFor="name" error={errors.name}>
                  <input id="name" className="input input--lg" value={form.name} onChange={e => setName(e.target.value)} maxLength={160} placeholder="e.g. D400 Double Seal Solid Top Cover" />
                </Field>
                <div className="form-row">
                  <Field label="Material" htmlFor="material" hint={onWebsite ? 'First line of the website card, e.g. Ductile Iron.' : 'e.g. Ductile Iron'}>
                    <input id="material" className="input" value={form.material} onChange={e => set('material', e.target.value)} maxLength={200} />
                  </Field>
                  <Field label="Load class" htmlFor="loadClass" hint={onWebsite ? 'Shown under the photo on the website card, e.g. D400. Leave empty if none.' : 'e.g. D400'}>
                    <input id="loadClass" className="input" value={form.loadClass} onChange={e => set('loadClass', e.target.value)} maxLength={40} />
                  </Field>
                </div>
                <Field label="Short description" htmlFor="summary" hint={onWebsite ? 'Shown on the website card (a blank line starts a new paragraph) and used for Google.' : 'One or two sentences for product cards and Google.'}>
                  <textarea id="summary" className="textarea" rows={3} value={form.summary} onChange={e => set('summary', e.target.value)} maxLength={600} />
                </Field>
                <Field label="Full description">
                  <RichEditor value={form.description} onChange={v => set('description', v)} folder="products" disabled={!canEdit} minHeight={220} placeholder="Describe the product, its uses, finish and options." />
                </Field>
              </Card>
              <Card title="Photos">
                <GalleryField value={form.images} onChange={v => set('images', v)} folder="products" disabled={!canEdit} />
              </Card>
              <Card title="Specifications">
                {onWebsite ? <p className="muted small" style={{ marginTop: -4, marginBottom: 12 }}>Each line is shown at the end of the website card as “Name: value”.</p> : null}
                <SpecsField value={form.specs} onChange={v => set('specs', v)} disabled={!canEdit} />
              </Card>
              <Card title="Sizes and load classes">
                <SpecTableField value={form.specTable} onChange={v => set('specTable', v)} disabled={!canEdit} />
              </Card>
              <Card title="Features, options, uses and standards">
                <div className="form-row">
                  <Field label="Features" htmlFor="features" hint={onWebsite ? 'One per line. Shown on the website card.' : 'One per line'}>
                    <textarea id="features" className="textarea" rows={6} value={form.features} onChange={e => set('features', e.target.value)} placeholder={'Anti-slip surface\nHigh load capacity'} />
                  </Field>
                  <Field label="Options" htmlFor="options" hint={onWebsite ? 'One per line. Shown on the website card.' : 'One per line'}>
                    <textarea id="options" className="textarea" rows={6} value={form.options} onChange={e => set('options', e.target.value)} placeholder={'Coating – Bitumen (Gloss/Matte), Epoxy coating\nHandling – Lifting keys'} />
                  </Field>
                </div>
                <div className="form-row">
                  <Field label="Applications" htmlFor="applications" hint="One per line">
                    <textarea id="applications" className="textarea" rows={6} value={form.applications} onChange={e => set('applications', e.target.value)} placeholder={'Highways\nCar parks'} />
                  </Field>
                  <Field label="Standards" htmlFor="standards" hint="One per line">
                    <textarea id="standards" className="textarea" rows={6} value={form.standards} onChange={e => set('standards', e.target.value)} placeholder={'BS EN 124 D400\nIS 1726'} />
                  </Field>
                </div>
              </Card>
              <Card title="Google and social media">
                <SeoFields title={form.seoTitle} description={form.seoDescription} fallbackTitle={form.name ? `${form.name} | JPK Metallics` : ''} fallbackDescription={form.summary} url={`jpkm.in › products › ${form.slug || 'product'}`} onChange={set} disabled={!canEdit} />
              </Card>
            </div>
            <div className="editor-grid__side">
              <Card title="Publish">
                <p style={{ marginBottom: 14 }}>{live ? <Badge status="published" /> : <Badge status="draft" />} <span className="muted small">{live ? 'available to the website' : 'not shown on the website'}</span></p>
                {canEdit ? (
                  <div className="actions-row">
                    <button type="button" className="btn btn--accent" onClick={() => save('published')} disabled={Boolean(busy)}>{busy === 'published' ? 'Saving…' : live ? 'Update' : 'Publish'}</button>
                    <button type="button" className="btn btn--ghost" onClick={() => save('draft')} disabled={Boolean(busy)}>{busy === 'draft' ? 'Saving…' : live ? 'Unpublish' : 'Save draft'}</button>
                  </div>
                ) : null}
                {dirty && canEdit ? <p className="field__hint" style={{ marginTop: 10 }}>You have unsaved changes.</p> : null}
              </Card>
              <Card title="Organise">
                <Field label="Category" htmlFor="category" hint={catLabel || 'Choose where the product belongs.'}>
                  <select id="category" className="select" value={form.category} onChange={e => set('category', e.target.value)}>
                    <option value="">— No category —</option>
                    {categories.map(c => <option key={c._id} value={c._id}>{`${'   '.repeat(c.depth)}${c.name}`}</option>)}
                  </select>
                </Field>
                {pageGroups.length > 1 ? (
                  <Field label="Place on the page" htmlFor="group" hint="The tab or block of the category's website page the product is shown in.">
                    <select id="group" className="select" value={group ? group.id : ''} onChange={e => set('group', e.target.value)}>
                      {pageGroups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </Field>
                ) : null}
                <div className="website-place" data-testid="website-place">
                  {onWebsite ? (
                    <p className="small" style={{ margin: '0 0 16px' }}>
                      <strong>On the website:</strong> {cat.pageName || catLabel}{pageGroups.length > 1 && group ? `, ${group.label}` : ''}
                      {live ? '' : ' (once published)'}.{' '}
                      {websiteUrl ? <a href={`${websiteUrl}${normPath(cat.path)}`} target="_blank" rel="noopener noreferrer">Open the page ↗</a> : null}
                    </p>
                  ) : (
                    <p className="muted small" style={{ margin: '0 0 16px' }}>{form.category ? 'This category has no product page on the website; show it with a “Products from the product list” section in Website › Pages & sections.' : 'Choose a category to show the product on its website page.'}</p>
                  )}
                </div>
                <Field label="Product code" htmlFor="code" hint="Optional, e.g. JPK-DI-D400-600">
                  <input id="code" className="input" value={form.code} onChange={e => set('code', e.target.value)} maxLength={60} />
                </Field>
                <Field label="Display order" htmlFor="order" hint={isNew ? 'Lower numbers are shown first (also on the website page). Empty: after the last product of its category.' : 'Lower numbers are shown first (also on the website page).'}>
                  <input id="order" className="input" type="number" value={form.order} onChange={e => set('order', e.target.value)} step="1" placeholder={isNew ? 'Last' : ''} />
                </Field>
                <label className="check" style={{ marginBottom: 18 }}>
                  <input type="checkbox" checked={form.featured} onChange={e => set('featured', e.target.checked)} />
                  <span><strong>Featured product</strong><br /><span className="muted small">Highlighted where the website shows featured products.</span></span>
                </label>
                <SlugField value={form.slug} onChange={v => { setSlugTouched(true); set('slug', v); }} published={live} disabled={!canEdit} />
              </Card>
              {!isNew && perms.delete ? (
                <Card title="Delete product" className="danger-zone">
                  <p className="muted small" style={{ marginBottom: 12 }}>Removes the product and its photos for good.</p>
                  <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={remove} disabled={Boolean(busy)}>{busy === 'delete' ? 'Deleting…' : 'Delete this product'}</button>
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
