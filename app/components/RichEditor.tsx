'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { useRef } from 'react';

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
}

function ToolbarBtn({
  active, onClick, title, children,
}: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className="flex items-center justify-center rounded-lg transition-all"
      style={{
        width: 30, height: 28,
        background: active ? 'rgba(175,198,255,0.18)' : 'transparent',
        color: active ? '#afc6ff' : '#8c90a1',
        border: active ? '1px solid rgba(175,198,255,0.3)' : '1px solid transparent',
        fontSize: 13,
        fontWeight: 600,
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#e4e1e9'; } }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8c90a1'; } }}>
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px', flexShrink: 0 }} />;
}

export default function RichEditor({ content, onChange }: RichEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start writing your entry…' }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'rich-editor-content',
        style: 'outline:none; min-height:260px; padding: 12px 4px;',
      },
      // Preserve rich text formatting on paste
      transformPastedHTML: (html) => html,
    },
  });

  // Show placeholder toolbar while editor initialises
  if (!editor) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="h-10" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }} />
        <div style={{ minHeight: 260, padding: '12px 16px' }} />
      </div>
    );
  }

  async function insertImage(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.url && editor) editor.chain().focus().setImage({ src: data.url }).run();
  }

  const headingLevel = editor.isActive('heading', { level: 1 }) ? 'H1'
    : editor.isActive('heading', { level: 2 }) ? 'H2'
    : editor.isActive('heading', { level: 3 }) ? 'H3'
    : 'P';

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 overflow-x-auto no-scrollbar flex-wrap"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>

        {/* Heading / paragraph selector */}
        <div className="flex items-center gap-0.5">
          {(['P', 'H1', 'H2', 'H3'] as const).map(tag => (
            <ToolbarBtn key={tag} title={tag === 'P' ? 'Paragraph' : `Heading ${tag[1]}`}
              active={headingLevel === tag}
              onClick={() => {
                if (tag === 'P') editor.chain().focus().setParagraph().run();
                else editor.chain().focus().toggleHeading({ level: parseInt(tag[1]) as 1|2|3 }).run();
              }}>
              <span style={{ fontSize: tag === 'H1' ? 13 : tag === 'H2' ? 12 : tag === 'H3' ? 11 : 12 }}>{tag}</span>
            </ToolbarBtn>
          ))}
        </div>

        <Divider />

        {/* Text formatting */}
        <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <strong>B</strong>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <em>I</em>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <span style={{ textDecoration: 'underline' }}>U</span>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </ToolbarBtn>

        <Divider />

        {/* Lists */}
        <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>format_list_bulleted</span>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>format_list_numbered</span>
        </ToolbarBtn>

        <Divider />

        {/* Alignment */}
        <ToolbarBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>format_align_left</span>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align centre">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>format_align_center</span>
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>format_align_right</span>
        </ToolbarBtn>

        <Divider />

        {/* Blockquote */}
        <ToolbarBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>format_quote</span>
        </ToolbarBtn>

        {/* Horizontal rule */}
        <ToolbarBtn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>horizontal_rule</span>
        </ToolbarBtn>

        <Divider />

        {/* Image upload */}
        <ToolbarBtn active={false} onClick={() => fileRef.current?.click()} title="Insert image">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_photo_alternate</span>
        </ToolbarBtn>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { if (e.target.files?.[0]) insertImage(e.target.files[0]); e.target.value = ''; }} />

        {/* Undo / Redo */}
        <div className="ml-auto flex gap-0.5 flex-shrink-0">
          <Divider />
          <ToolbarBtn active={false} onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>undo</span>
          </ToolbarBtn>
          <ToolbarBtn active={false} onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>redo</span>
          </ToolbarBtn>
        </div>
      </div>

      {/* Editor area */}
      <div className="px-4 py-2">
        <EditorContent editor={editor} />
      </div>

    </div>
  );
}
