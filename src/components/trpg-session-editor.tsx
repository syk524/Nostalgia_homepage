'use client'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Minus } from 'lucide-react'

// The extension set is shared between the editable form here and the
// read-only render on the detail page (TrpgSessionView) — same schema on
// both ends, so what got typed/pasted in is exactly what renders back out,
// nothing silently dropped on one side.
export const TRPG_EXTENSIONS = [StarterKit, TextStyle, Color]

function ToolbarButton({ active, onClick, label, children }: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`pill ${active ? 'pill-active' : ''}`}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-2 mb-2 border-b border-ink/10">
      <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={13} />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={13} />
      </ToolbarButton>
      <ToolbarButton label="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 size={13} />
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={13} />
      </ToolbarButton>
      <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={13} />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={13} />
      </ToolbarButton>
      <ToolbarButton label="Divider" active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus size={13} />
      </ToolbarButton>
      <div className="w-px h-5 bg-ink/10 mx-1" />
      {/* Same 8-line native <input type="color"> swatch shape as
          character-pair-form.tsx's local ColorSwatch (not exported from
          there today, so this is its own small copy rather than a
          cross-file refactor) — applies to the current selection only,
          same as every other inline mark here. */}
      <input
        type="color"
        aria-label="Text color"
        onChange={e => editor.chain().focus().setColor(e.target.value).run()}
        className="h-7 w-7 rounded-full border border-ink/10 cursor-pointer shrink-0"
      />
    </div>
  )
}

export function TrpgSessionEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: TRPG_EXTENSIONS,
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  if (!editor) return null

  return (
    <div className="textarea min-h-[400px]">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="trpg-content" />
    </div>
  )
}

// Read-only render for the detail page — same extension set as the
// editable form above, so whatever marks/nodes a paste or the toolbar
// produced on the way in render back out identically, nothing silently
// dropped on one side of the schema. No toolbar, no onUpdate.
export function TrpgSessionView({ content }: { content: string }) {
  const editor = useEditor({
    extensions: TRPG_EXTENSIONS,
    content,
    editable: false,
    immediatelyRender: false,
  })

  if (!editor) return null

  return <EditorContent editor={editor} className="trpg-content" />
}
