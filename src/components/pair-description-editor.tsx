'use client'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, List } from 'lucide-react'
import type { CSSProperties } from 'react'

// Deliberately narrow — bold/italic/bullet list only, reported directly,
// with every other StarterKit mark/node (headings, blockquote, code,
// ordered list, horizontal rule, strike) turned off so neither the
// toolbar nor its markdown-shortcut input rules (e.g. typing "# ") can
// reach them. history/hardBreak/paragraph/text/document stay on — plain
// editing mechanics, not "formatting options."
const EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    blockquote: false,
    codeBlock: false,
    code: false,
    horizontalRule: false,
    strike: false,
    orderedList: false,
  }),
]

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
    <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-ink/10">
      <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={13} />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={13} />
      </ToolbarButton>
      <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={13} />
      </ToolbarButton>
    </div>
  )
}

// A section's own description field — same trpg-content-style pattern as
// trpg-session-editor.tsx (editable form + read-only PairDescriptionView
// below share one extension set, so a save round-trips identically), just
// scoped to a single short field instead of a whole session log: no fixed
// height/internal scroll, no image/table support, no per-selection color
// picker (text_color is set once for the whole section elsewhere in
// SectionsEditor, not per span).
export function PairDescriptionEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: EXTENSIONS,
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  if (!editor) return null

  return (
    <div className="textarea">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="pair-desc-content pair-desc-editable" />
    </div>
  )
}

// Read-only render for the detail page (character-pair-detail.tsx) — same
// extension set as the editable form above. className/style let each call
// site keep applying its own text size/color the way the old plain <p>
// did (CharacterDescriptionSections' text-sm, CharacterCard's
// text_color), rather than baking those into this shared component.
export function PairDescriptionView({ content, className, style }: { content: string; className?: string; style?: CSSProperties }) {
  const editor = useEditor({
    extensions: EXTENSIONS,
    content,
    editable: false,
    immediatelyRender: false,
  })

  if (!editor) return null

  return <EditorContent editor={editor} className={`pair-desc-content ${className ?? ''}`} style={style} />
}
