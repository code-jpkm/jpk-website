'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, Card, Field, Notice, Badge, Icon } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { useFormState } from '@/components/useFormState';
import RichEditor from '@/components/fields/RichEditor';
import ImageField from '@/components/fields/ImageField';
import SeoFields from '@/components/fields/SeoFields';
import SlugField, { slugify } from '@/components/fields/SlugField';
import { api } from '@/lib/client/api';
import { formatDate, toDateTimeInput, fromDateTimeInput } from '@/lib/format';

function toForm(d = {}) {
  return {
    title: d.title || '',
    slug: d.slug || '',
    excerpt: d.excerpt || '',
    content: d.content || '',
    coverImage: d.coverImage || null,
    category: d.category || 'JPK Updates',
    tags: (d.tags || []).join(', '),
    status: d.status || 'draft',
    publishedAt: toDateTimeInput(d.publishedAt),
    authorName: d.authorName || 'JPK Metallics',
    seoTitle: d.seoTitle || '',
    seoDescription: d.seoDescription || '',
  };
}

export default function BlogForm({ initial, siteUrl, categories = [], perms }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const isNew = !initial;
  const [saved, setSaved] = useState(initial || null);
  const { form, set, reset, dirty } = useFormState(() => toForm(initial));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [busy, setBusy] = useState('');
  const [errors, setErrors] = useState({});
  const canEdit = isNew || perms.update;
  const live = saved && saved.status === 'published';

  const setTitle = v => {
    set('title', v);
    if (errors.title) setErrors({});
    if (!slugTouched) set('slug', slugify(v));
  };

  const save = async status => {
    if (!form.title.trim()) {
      setErrors({ title: 'Please enter a title.' });
      document.getElementById('title')?.focus();
      return;
    }
    if (status === 'draft' && live && !(await confirm({ title: 'Take this post off the website?', message: 'It will be saved as a draft and no longer shown on jpkm.in until you publish it again.', confirmLabel: 'Move to drafts', tone: 'primary' }))) return;
    if (status === 'published' && !live && !form.coverImage && !(await confirm({ title: 'Publish without a cover picture?', message: 'The JPK Updates page of the website shows each post with its picture. Without one, the post card looks plain.', confirmLabel: 'Publish anyway', tone: 'primary' }))) return;
    setErrors({});
    setBusy(status);
    const payload = {
      ...form,
      status,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      publishedAt: fromDateTimeInput(form.publishedAt),
    };
    try {
      if (isNew) {
        const { item } = await api('/api/admin/blogs', { method: 'POST', body: payload });
        reset(toForm(item));
        toast.success(status === 'published' ? 'Post published on the website.' : 'Draft saved.');
        router.replace(`/admin/blogs/${item._id}`);
      } else {
        const { item } = await api(`/api/admin/blogs/${saved._id}`, { method: 'PATCH', body: payload });
        setSaved(item);
        reset(toForm(item));
        toast.success(status === 'published' ? (live ? 'Changes are live on the website.' : 'Post published on the website.') : 'Draft saved.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Delete this post?', message: `“${saved.title}” will be removed${live ? ' from the website' : ''}. This cannot be undone.`, confirmLabel: 'Delete post' }))) return;
    setBusy('delete');
    try {
      await api(`/api/admin/blogs/${saved._id}`, { method: 'DELETE' });
      reset(form);
      toast.success('Post deleted.');
      router.push('/admin/blogs');
    } catch (err) {
      toast.error(err.message);
      setBusy('');
    }
  };

  const postUrl = `${siteUrl}/jpk-updates/${form.slug || 'your-post'}/`;

  return (
    <>
      <PageHeader
        back={{ href: '/admin/blogs', label: 'JPK Updates' }}
        title={isNew ? 'New post' : form.title || 'Edit post'}
        actions={live ? <a href={`${siteUrl}/jpk-updates/${saved.slug}/`} target="_blank" rel="noopener noreferrer" className="btn btn--ghost"><Icon name="external" size={16} />View on website</a> : null}
      />
      {!canEdit ? <Notice tone="info" title="Read only">You can read this post but your account cannot change it.</Notice> : null}
      <form onSubmit={e => { e.preventDefault(); if (canEdit) save(live ? 'published' : 'draft'); }} noValidate>
        <fieldset className="plain" disabled={!canEdit || Boolean(busy)}>
          <div className="editor-grid">
            <div>
              <Card>
                <Field label="Title" required htmlFor="title" error={errors.title}>
                  <input id="title" className="input input--lg" value={form.title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder="e.g. JPK Metallics at IFEX 2026" />
                </Field>
                <Field label="Article">
                  <RichEditor value={form.content} onChange={v => set('content', v)} folder="jpk-updates" disabled={!canEdit} placeholder="Write the article. Use headings, lists and pictures." />
                </Field>
                <Field label="Short summary" htmlFor="excerpt" hint="Shown in the list of updates and in Google. Leave empty to use the first lines of the article.">
                  <textarea id="excerpt" className="textarea" rows={3} value={form.excerpt} onChange={e => set('excerpt', e.target.value)} maxLength={600} />
                </Field>
              </Card>
              <Card title="Google and social media">
                <SeoFields title={form.seoTitle} description={form.seoDescription} fallbackTitle={form.title ? `${form.title} | JPK Updates – JPK Metallics` : ''} fallbackDescription={form.excerpt} url={postUrl} onChange={set} disabled={!canEdit} />
              </Card>
            </div>
            <div className="editor-grid__side">
              <Card title="Publish">
                <p style={{ marginBottom: 14 }}>
                  {live ? <><Badge status="published" /> <span className="muted small">on the website since {formatDate(saved.publishedAt)}</span></>
                    : <><Badge status="draft" /> <span className="muted small">not visible on the website</span></>}
                </p>
                <Field label="Publish date" htmlFor="publishedAt" hint="Leave empty to use the moment you publish. A future date keeps the post hidden until then (India time).">
                  <input id="publishedAt" type="datetime-local" className="input" value={form.publishedAt} onChange={e => set('publishedAt', e.target.value)} />
                </Field>
                {canEdit ? (
                  <div className="actions-row">
                    <button type="button" className="btn btn--accent" onClick={() => save('published')} disabled={Boolean(busy)}>{busy === 'published' ? 'Saving…' : live ? 'Update' : 'Publish'}</button>
                    <button type="button" className="btn btn--ghost" onClick={() => save('draft')} disabled={Boolean(busy)}>{busy === 'draft' ? 'Saving…' : live ? 'Move to drafts' : 'Save draft'}</button>
                  </div>
                ) : null}
                {dirty && canEdit ? <p className="field__hint" style={{ marginTop: 10 }}>You have unsaved changes.</p> : null}
              </Card>
              <Card title="Cover picture">
                <ImageField value={form.coverImage} onChange={v => set('coverImage', v)} folder="jpk-updates" disabled={!canEdit} />
                <p className="field__hint" style={{ marginTop: 8 }}>Shown at the top of the post and in the list. Landscape, at least 1200 px wide.</p>
              </Card>
              <Card title="Details">
                <Field label="Category" htmlFor="category">
                  <input id="category" className="input" list="blog-categories" value={form.category} onChange={e => set('category', e.target.value)} maxLength={80} />
                  <datalist id="blog-categories">{[...new Set(['JPK Updates', 'News', 'Events', 'Material Engineering', ...categories])].map(c => <option key={c} value={c} />)}</datalist>
                </Field>
                <Field label="Tags" htmlFor="tags" hint="Separate with commas, e.g. ductile iron, exhibitions">
                  <input id="tags" className="input" value={form.tags} onChange={e => set('tags', e.target.value)} />
                </Field>
                <Field label="Author" htmlFor="authorName">
                  <input id="authorName" className="input" value={form.authorName} onChange={e => set('authorName', e.target.value)} maxLength={120} />
                </Field>
                <SlugField value={form.slug} onChange={v => { setSlugTouched(true); set('slug', v); }} prefix={`${siteUrl.replace(/^https?:\/\//, '')}/jpk-updates/`} published={live} disabled={!canEdit} />
              </Card>
              {!isNew && perms.delete ? (
                <Card title="Delete post" className="danger-zone">
                  <p className="muted small" style={{ marginBottom: 12 }}>Removes the post{live ? ' from the website' : ''} for good.</p>
                  <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={remove} disabled={Boolean(busy)}>{busy === 'delete' ? 'Deleting…' : 'Delete this post'}</button>
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
