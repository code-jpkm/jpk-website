'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { uploadImage } from '@/lib/client/api';
import { IMAGE_ACCEPT } from './ImageField';

function ToolButton({ on, label, active, children, disabled, off }) {
  return (
    <button type="button" className={`rte__btn${active ? ' is-active' : ''}`} onMouseDown={e => e.preventDefault()} onClick={on} title={label} aria-label={label} aria-pressed={active === undefined ? undefined : Boolean(active)} disabled={disabled || off}>
      {children}
    </button>
  );
}

// Word-processor style editor for articles, product descriptions and job descriptions.
// Saves clean HTML; pictures are uploaded (also when pasted or dropped into the text).
export default function RichEditor({ value, onChange, folder = 'misc', placeholder = 'Start writing…', disabled = false, minHeight = 320, id }) {
  const fileInput = useRef(null);
  const uploadRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [linkBar, setLinkBar] = useState(null); // { href, newTab }
  const lastHtml = useRef(value || '');

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
        code: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { target: null, rel: null, class: null } },
      }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value || '',
    editorProps: {
      attributes: { class: 'rte__content', 'aria-label': 'Text editor', ...(id ? { id } : {}), 'data-placeholder': placeholder },
      handlePaste: (view, event) => {
        const files = [...((event.clipboardData && event.clipboardData.files) || [])].filter(f => f.type.startsWith('image/'));
        if (!files.length) return false;
        uploadRef.current(files);
        return true;
      },
      handleDrop: (view, event, slice, moved) => {
        if (moved) return false;
        const files = [...((event.dataTransfer && event.dataTransfer.files) || [])].filter(f => f.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        uploadRef.current(files);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? '' : ed.getHTML();
      if (html === lastHtml.current) return;
      lastHtml.current = html;
      onChange(html);
    },
  });

  useEffect(() => {
    // second argument false: switching read-only on/off is not a change to the text
    if (editor && editor.isEditable === disabled) editor.setEditable(!disabled, false);
  }, [editor, disabled]);

  const s = useEditorState({
    editor,
    selector: ({ editor: ed }) => (ed ? {
      bold: ed.isActive('bold'), italic: ed.isActive('italic'), underline: ed.isActive('underline'), strike: ed.isActive('strike'),
      h2: ed.isActive('heading', { level: 2 }), h3: ed.isActive('heading', { level: 3 }), h4: ed.isActive('heading', { level: 4 }),
      bullet: ed.isActive('bulletList'), ordered: ed.isActive('orderedList'), quote: ed.isActive('blockquote'), link: ed.isActive('link'),
      canUndo: ed.can().undo(), canRedo: ed.can().redo(), empty: ed.isEmpty,
    } : {}),
  }) || {};

  uploadRef.current = async files => {
    setError('');
    for (const file of files) {
      setBusy(`Uploading ${file.name}…`);
      try {
        const img = await uploadImage(file, { folder });
        editor.chain().focus().setImage({ src: img.url, alt: '' }).run();
      } catch (err) {
        setError(err.message);
      }
    }
    setBusy('');
  };

  if (!editor) return <div className="rte rte--loading" style={{ minHeight }} />;

  const block = s.h2 ? 'h2' : s.h3 ? 'h3' : s.h4 ? 'h4' : 'p';
  const setBlock = v => {
    const c = editor.chain().focus();
    if (v === 'p') c.setParagraph().run();
    else c.setHeading({ level: Number(v.slice(1)) }).run();
  };

  const openLink = () => {
    const attrs = editor.getAttributes('link');
    setLinkBar({ href: attrs.href || '', newTab: attrs.target === '_blank' });
  };
  const applyLink = () => {
    let href = (linkBar.href || '').trim();
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setLinkBar(null);
      return;
    }
    if (!/^(https?:|mailto:|tel:|\/|#)/i.test(href)) href = href.includes('@') && !href.includes('/') ? `mailto:${href}` : `https://${href}`;
    const attrs = { href, target: linkBar.newTab ? '_blank' : null };
    if (editor.state.selection.empty && !editor.isActive('link')) {
      editor.chain().focus().insertContent({ type: 'text', text: href.replace(/^mailto:/, ''), marks: [{ type: 'link', attrs }] }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink(attrs).run();
    }
    setLinkBar(null);
  };

  return (
    <div className={`rte${disabled ? ' rte--disabled' : ''}`}>
      <div className="rte__toolbar" role="toolbar" aria-label="Formatting">
        <select className="rte__select" value={block} onChange={e => setBlock(e.target.value)} disabled={disabled} aria-label="Text style">
          <option value="p">Normal text</option>
          <option value="h2">Heading</option>
          <option value="h3">Sub-heading</option>
          <option value="h4">Small heading</option>
        </select>
        <span className="rte__sep" />
        <ToolButton disabled={disabled} on={() => editor.chain().focus().toggleBold().run()} label="Bold" active={s.bold}><strong>B</strong></ToolButton>
        <ToolButton disabled={disabled} on={() => editor.chain().focus().toggleItalic().run()} label="Italic" active={s.italic}><em>I</em></ToolButton>
        <ToolButton disabled={disabled} on={() => editor.chain().focus().toggleUnderline().run()} label="Underline" active={s.underline}><span style={{ textDecoration: 'underline' }}>U</span></ToolButton>
        <ToolButton disabled={disabled} on={() => editor.chain().focus().toggleStrike().run()} label="Strikethrough" active={s.strike}><s>S</s></ToolButton>
        <span className="rte__sep" />
        <ToolButton disabled={disabled} on={() => editor.chain().focus().toggleBulletList().run()} label="Bulleted list" active={s.bullet}>• List</ToolButton>
        <ToolButton disabled={disabled} on={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered list" active={s.ordered}>1. List</ToolButton>
        <ToolButton disabled={disabled} on={() => editor.chain().focus().toggleBlockquote().run()} label="Quote" active={s.quote}>❝</ToolButton>
        <ToolButton disabled={disabled} on={() => editor.chain().focus().setHorizontalRule().run()} label="Divider line">―</ToolButton>
        <span className="rte__sep" />
        <ToolButton disabled={disabled} on={openLink} label="Link" active={s.link}>Link</ToolButton>
        <ToolButton disabled={disabled} on={() => fileInput.current && fileInput.current.click()} label="Insert picture">Picture</ToolButton>
        <span className="rte__sep" />
        <ToolButton disabled={disabled} on={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} label="Clear formatting">Tx</ToolButton>
        <ToolButton disabled={disabled} on={() => editor.chain().focus().undo().run()} label="Undo" off={!s.canUndo}>↶</ToolButton>
        <ToolButton disabled={disabled} on={() => editor.chain().focus().redo().run()} label="Redo" off={!s.canRedo}>↷</ToolButton>
      </div>
      {linkBar ? (
        <div className="rte__linkbar">
          <input
            className="input input--sm"
            autoFocus
            placeholder="https://… or an email address"
            value={linkBar.href}
            onChange={e => setLinkBar(l => ({ ...l, href: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') setLinkBar(null); }}
            aria-label="Link address"
          />
          <label className="check check--inline"><input type="checkbox" checked={linkBar.newTab} onChange={e => setLinkBar(l => ({ ...l, newTab: e.target.checked }))} /> Open in a new tab</label>
          <button type="button" className="btn btn--primary btn--sm" onClick={applyLink}>Apply</button>
          {s.link ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkBar(null); }}>Remove link</button> : null}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLinkBar(null)}>Cancel</button>
        </div>
      ) : null}
      <div className="rte__area" style={{ minHeight }} onClick={e => { if (e.target === e.currentTarget) editor.chain().focus('end').run(); }}>
        {s.empty ? <span className="rte__placeholder" aria-hidden="true">{placeholder}</span> : null}
        <EditorContent editor={editor} />
      </div>
      {busy ? <p className="rte__status">{busy}</p> : null}
      {error ? <p className="field__error" role="alert">{error}</p> : null}
      <input ref={fileInput} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) uploadRef.current(f); }} />
    </div>
  );
}
