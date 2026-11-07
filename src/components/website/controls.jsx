'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import RichEditor from '@/components/fields/RichEditor';
import MediaPicker from './MediaPicker';
import { htmlToText, textToHtml, hasFormatting, inlineFromRich, thumbOf, builtInPicture, absolute, pictureFallback } from './util';

// The boxes of the website editor. Each gets the saved value (undefined = as built) and the built-in value.

function autosize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight + 2, 420)}px`;
}

// a line of text with bold, italic and links (for texts that have formatting)
function InlineEditor({ value, onChange, id }) {
  const last = useRef(value || '');
  const [linkBar, setLinkBar] = useState(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: false, bulletList: false, orderedList: false, listItem: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, strike: false, link: { openOnClick: false, autolink: false, HTMLAttributes: { target: null, rel: null, class: null } } })],
    content: `<p>${value || ''}</p>`,
    editorProps: { attributes: { class: 'inline-rte__content', ...(id ? { id } : {}) } },
    onUpdate: ({ editor: ed }) => {
      const html = inlineFromRich(ed.getHTML());
      if (html === last.current) return;
      last.current = html;
      onChange(html);
    },
  });
  // the value changed from outside (undo): show it
  useEffect(() => {
    if (!editor || value === last.current) return;
    last.current = value || '';
    editor.commands.setContent(`<p>${value || ''}</p>`, { emitUpdate: false });
  }, [editor, value]);
  const s = useEditorState({ editor, selector: ({ editor: ed }) => (ed ? { bold: ed.isActive('bold'), italic: ed.isActive('italic'), link: ed.isActive('link') } : {}) }) || {};
  if (!editor) return <div className="inline-rte inline-rte--loading" />;
  const applyLink = () => {
    let href = (linkBar.href || '').trim();
    if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else {
      if (!/^(https?:|mailto:|tel:|\/|#)/i.test(href)) href = href.includes('@') ? `mailto:${href}` : `https://${href}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href, target: linkBar.newTab ? '_blank' : null }).run();
    }
    setLinkBar(null);
  };
  return (
    <div className="inline-rte">
      <div className="inline-rte__bar">
        <button type="button" className={`rte__btn${s.bold ? ' is-active' : ''}`} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold" title="Bold"><strong>B</strong></button>
        <button type="button" className={`rte__btn${s.italic ? ' is-active' : ''}`} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic" title="Italic"><em>I</em></button>
        <button type="button" className={`rte__btn${s.link ? ' is-active' : ''}`} onMouseDown={e => e.preventDefault()} onClick={() => { const a = editor.getAttributes('link'); setLinkBar({ href: a.href || '', newTab: a.target === '_blank' }); }} aria-label="Link" title="Link">Link</button>
        <span className="muted small">Shift+Enter: new line</span>
      </div>
      {linkBar ? (
        <div className="rte__linkbar">
          <input className="input input--sm" autoFocus placeholder="/contact-us/ or https://…" value={linkBar.href} onChange={e => setLinkBar(l => ({ ...l, href: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }} aria-label="Link address" />
          <label className="check check--inline"><input type="checkbox" checked={linkBar.newTab} onChange={e => setLinkBar(l => ({ ...l, newTab: e.target.checked }))} /> New tab</label>
          <button type="button" className="btn btn--primary btn--sm" onClick={applyLink}>Apply</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLinkBar(null)}>Cancel</button>
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

// Text: a text box, or the small formatting editor for texts with links or bold words
export function TextControl({ value, builtIn, onChange, id, single }) {
  const html = value !== undefined ? value : builtIn || '';
  const [rich, setRich] = useState(() => hasFormatting(html));
  const ref = useRef(null);
  useEffect(() => { autosize(ref.current); }, [html, rich]);
  if (rich) return <InlineEditor value={html} onChange={onChange} id={id} />;
  const text = htmlToText(html);
  return (
    <div className="text-control">
      <textarea ref={ref} id={id} className="textarea text-control__box" rows={single ? 1 : 2} value={text}
        onChange={e => { autosize(e.target); onChange(textToHtml(e.target.value)); }} />
      <button type="button" className="btn btn--link small text-control__fmt" onClick={() => setRich(true)}>Add bold, italic or a link…</button>
    </div>
  );
}

export function RichControl({ value, builtIn, onChange, id }) {
  return <RichEditor value={value !== undefined ? value : builtIn || ''} onChange={onChange} folder="website" minHeight={140} id={id} />;
}

// A link: an address (a page of the website or any web address) and "open in a new tab"
export function LinkControl({ value, builtIn, onChange, pages = [], withLabel = false, labelPlaceholder = 'Button text', id }) {
  const listId = useId();
  const v = value || {};
  const href = value !== undefined && value !== null ? v.href || '' : (builtIn && builtIn.href) || '';
  const newTab = value !== undefined && value !== null ? Boolean(v.newTab) : Boolean(builtIn && builtIn.newTab);
  const set = patch => onChange({ href, newTab, ...(withLabel ? { label: v.label || '' } : {}), ...patch });
  return (
    <div className="link-control">
      {withLabel ? <input className="input input--sm" placeholder={labelPlaceholder} value={v.label || ''} onChange={e => set({ label: e.target.value })} aria-label="Button text" /> : null}
      <input className="input input--sm" id={id} list={listId} placeholder="/contact-us/ or https://…" value={href} onChange={e => set({ href: e.target.value })} aria-label="Link address" />
      <datalist id={listId}>{pages.map(p => <option key={p.path} value={p.path}>{p.name}</option>)}</datalist>
      <label className="check check--inline"><input type="checkbox" checked={newTab} onChange={e => set({ newTab: e.target.checked })} /> Open in a new tab</label>
    </div>
  );
}

// A picture: the current one (replaced or built-in), replace, undo, description
export function ImageControl({ value, builtIn, onChange, websiteUrl, allowRemove = false, aspect }) {
  const [open, setOpen] = useState(false);
  const shown = value && value.url ? thumbOf(value.url, 600) : builtIn ? builtInPicture(websiteUrl, builtIn, 800) : '';
  return (
    <div className="image-control">
      <button type="button" className="image-control__pic" onClick={() => setOpen(true)} style={aspect ? { aspectRatio: aspect } : undefined} title="Replace this picture">
        {shown ? <img src={shown} alt="" onError={value && value.url ? undefined : pictureFallback(websiteUrl, builtIn, 800)} /> : <span className="image-control__empty">No picture yet: click to add one</span>}
      </button>
      <div className="image-control__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>{shown ? 'Replace…' : 'Add a picture…'}</button>
        {value && value.url && builtIn ? <button type="button" className="btn btn--link btn--sm" onClick={() => onChange(undefined)}>Use the original picture</button> : null}
        {value && value.url && allowRemove ? <button type="button" className="btn btn--link btn--sm btn--danger-text" onClick={() => onChange(null)}>Remove</button> : null}
      </div>
      {value && value.url ? (
        <input className="input input--sm" placeholder={builtIn && builtIn.alt ? `Description (was: ${builtIn.alt})` : 'Describe the picture (for Google and screen readers)'} value={value.alt || ''} onChange={e => onChange({ ...value, alt: e.target.value })} aria-label="Picture description" maxLength={300} />
      ) : null}
      <MediaPicker open={open} onClose={() => setOpen(false)} onPick={pic => onChange({ ...pic, alt: (value && value.alt) || (builtIn && builtIn.alt) || pic.alt || '' })} />
    </div>
  );
}

// A list of pictures (slider, gallery, logos): reorder, remove, add
export function GalleryControl({ value, builtIn = [], onChange, websiteUrl, builtInAllowed = true }) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(value) ? value : builtIn;
  const set = list => onChange(list);
  const move = (i, d) => { const l = [...items]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); set(l); };
  return (
    <div className="gallery-control">
      <div className="gallery-control__grid">
        {items.map((it, i) => (
          <div key={`${it.url || it.src}-${i}`} className="gallery-control__item">
            <img src={builtInPicture(websiteUrl, it, 400)} alt="" onError={it.url ? undefined : pictureFallback(websiteUrl, it, 400)} />
            <div className="gallery-control__tools">
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier">←</button>
              <button type="button" className="icon-btn" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move later">→</button>
              <button type="button" className="icon-btn icon-btn--danger" onClick={() => set(items.filter((_, j) => j !== i))} aria-label="Remove">×</button>
            </div>
            <input className="input input--sm" placeholder="Description" value={it.alt || ''} onChange={e => set(items.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} aria-label="Picture description" />
          </div>
        ))}
      </div>
      <div className="image-control__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setOpen(true)}>+ Add pictures…</button>
        {Array.isArray(value) && builtInAllowed && builtIn.length ? <button type="button" className="btn btn--link btn--sm" onClick={() => onChange(undefined)}>Use the original pictures</button> : null}
      </div>
      <MediaPicker multiple open={open} onClose={() => setOpen(false)} onPick={pics => set([...items, ...pics])} title="Add pictures" />
    </div>
  );
}

export function NumberControl({ value, builtIn, onChange, id }) {
  return <input type="number" id={id} className="input input--sm number-control" value={value !== undefined ? value : builtIn ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />;
}

// ---- forms of the section builder (from the website's section types) ----

// the product categories of the admin's Products list (loaded once)
let categoriesPromise = null;
function CategorySelect({ value, onChange, id }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    if (!categoriesPromise) categoriesPromise = fetch('/api/public/categories', { headers: { Accept: 'application/json' } }).then(r => r.json()).then(j => j.items || []).catch(() => { categoriesPromise = null; return []; });
    let alive = true;
    categoriesPromise.then(list => { if (alive) setItems(list); });
    return () => { alive = false; };
  }, []);
  return (
    <select id={id} className="select input--sm" value={value || ''} onChange={e => onChange(e.target.value || undefined)}>
      <option value="">{items ? 'Choose a category…' : 'Loading categories…'}</option>
      {(items || []).map(c => <option key={c.id} value={c.slug}>{`${'— '.repeat(c.depth || 0)}${c.name}`} ({c.productCount} published)</option>)}
    </select>
  );
}

function FieldInput({ f, value, onChange, ctx, id }) {
  switch (f.type) {
    case 'category': return <CategorySelect id={id} value={value} onChange={onChange} />;
    case 'text': return <input id={id} className="input input--sm" value={value || ''} onChange={e => onChange(e.target.value)} maxLength={400} />;
    case 'textarea': return f.code
      ? <textarea id={id} className="textarea mono" rows={8} value={value || ''} onChange={e => onChange(e.target.value)} spellCheck={false} />
      : <textarea id={id} className="textarea" rows={3} value={value || ''} onChange={e => onChange(e.target.value)} />;
    case 'rich': return <RichEditor value={value || ''} onChange={onChange} folder="website" minHeight={120} id={id} />;
    case 'image': return <ImageControl value={value || undefined} onChange={v => onChange(v || undefined)} websiteUrl={ctx.websiteUrl} allowRemove />;
    case 'images': return <GalleryControl value={Array.isArray(value) ? value : []} onChange={v => onChange(v || [])} websiteUrl={ctx.websiteUrl} builtInAllowed={false} />;
    case 'link': return <LinkControl value={value || undefined} onChange={onChange} pages={ctx.pages} withLabel id={id} />;
    case 'color': return <input id={id} type="color" className="color-input" value={value || '#203444'} onChange={e => onChange(e.target.value)} />;
    case 'select': return (
      <select id={id} className="select input--sm" value={value !== undefined ? String(value) : String(f.default ?? (f.options[0] || [])[0])} onChange={e => onChange(e.target.value)}>
        {f.options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
    );
    case 'number': return <input id={id} type="number" className="input input--sm number-control" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />;
    case 'toggle': return <label className="check check--inline"><input id={id} type="checkbox" checked={value !== undefined ? Boolean(value) : Boolean(f.default)} onChange={e => onChange(e.target.checked)} /> Yes</label>;
    case 'list': return <ListControl f={f} value={Array.isArray(value) ? value : []} onChange={onChange} ctx={ctx} />;
    default: return null;
  }
}

function ListControl({ f, value, onChange, ctx }) {
  const [open, setOpen] = useState(() => (value.length <= 2 ? value.map((_, i) => i) : []));
  const set = list => onChange(list);
  const move = (i, d) => { const l = [...value]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); set(l); setOpen([i + d]); };
  const label = (it, i) => it.title || it.name || it.question || it.label || (it.number !== undefined ? `${it.number}${it.suffix || ''}` : '') || `${f.itemLabel || 'Item'} ${i + 1}`;
  return (
    <div className="list-control">
      {value.map((it, i) => (
        <div key={i} className={`list-control__item${open.includes(i) ? ' is-open' : ''}`} data-field={`${ctx.prefix || ''}items.${i}`}>
          <div className="list-control__head">
            <button type="button" className="list-control__title" onClick={() => setOpen(o => (o.includes(i) ? o.filter(x => x !== i) : [...o, i]))} aria-expanded={open.includes(i)}>
              <span className="list-control__caret" aria-hidden="true">▸</span>{label(it, i)}
            </button>
            <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button type="button" className="icon-btn" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            <button type="button" className="icon-btn" onClick={() => { const l = [...value]; l.splice(i + 1, 0, JSON.parse(JSON.stringify(it))); set(l); }} aria-label="Duplicate">⧉</button>
            <button type="button" className="icon-btn icon-btn--danger" onClick={() => set(value.filter((_, j) => j !== i))} aria-label="Remove">×</button>
          </div>
          {open.includes(i) ? (
            <div className="list-control__body">
              {(f.fields || []).map(sub => (
                <Labeled key={sub.key} f={sub}>
                  {id => <FieldInput id={id} f={sub} value={it[sub.key]} ctx={ctx} onChange={v => set(value.map((x, j) => (j === i ? { ...x, [sub.key]: v } : x)))} />}
                </Labeled>
              ))}
            </div>
          ) : null}
        </div>
      ))}
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => { set([...value, {}]); setOpen(o => [...o, value.length]); }}>+ Add {String(f.itemLabel || 'item').toLowerCase()}</button>
    </div>
  );
}

function Labeled({ f, children }) {
  const id = useId();
  return (
    <div className="ws-field" data-field={f.key}>
      <label className="ws-field__label" htmlFor={id}>{f.label}</label>
      {children(id)}
      {f.hint ? <p className="field__hint">{f.hint}</p> : null}
    </div>
  );
}

export function BuilderForm({ def, data, onChange, ctx }) {
  const d = data || {};
  return (
    <div className="builder-form">
      {def.description ? <p className="muted small">{def.description}</p> : null}
      {(def.fields || []).map(f => (
        <Labeled key={f.key} f={f}>
          {id => <FieldInput id={id} f={f} value={d[f.key]} ctx={ctx} onChange={v => onChange({ ...d, [f.key]: v })} />}
        </Labeled>
      ))}
    </div>
  );
}

export { absolute };
