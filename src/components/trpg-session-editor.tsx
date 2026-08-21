'use client'
import { useRef } from 'react'
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
  const wrapperRef = useRef<HTMLDivElement>(null)

  if (!editor) return null

  // The actual contentEditable region (.ProseMirror, inside EditorContent)
  // is only ever as tall as its real content — a single empty line at
  // first, nowhere near this box's own min-h-[400px] — so most of what
  // visually reads as "the text field" isn't part of it at all, and
  // clicking there focuses nothing (looks exactly like a broken input).
  // Tried making the wrapper around EditorContent flex-1/h-full to grow
  // the actual clickable region to match — the height never propagated
  // down through Tiptap's own internal wrapper div to the real
  // .ProseMirror element, so that click still landed outside it. Handling
  // the click at the outer box level instead sidesteps that entirely: it
  // only needs THIS div's own height (a real min-h-[400px], not something
  // relying on a child growing to match it), with an explicit bail-out
  // for clicks that started on a toolbar button so this can't fire after
  // — and undo — a button's own focus-and-format action.
  //
  // Plain DOM .focus() on the .ProseMirror element, not
  // editor.commands.focus() — confirmed by hand that in this dev
  // environment editor.commands.focus() reports success (returns true)
  // while document.activeElement never actually changes, but calling
  // .focus() directly on the real DOM node works every time. Queried via
  // wrapperRef rather than editor.view.dom for the same reason: whatever
  // stale-reference issue makes the commands API unreliable here might
  // affect editor.view.dom too, and a fresh querySelector sidesteps that
  // possibility entirely rather than trusting either cached reference.
  function focusEditorUnlessToolbar(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    // A click that landed inside the real editable content (existing
    // text, not the dead padding below/around it) already has its own
    // native click-to-position-cursor behavior — jumping to 'end' here
    // too would override wherever the user actually clicked.
    if (target.closest('.ProseMirror')) return
    e.preventDefault()
    const pm = wrapperRef.current?.querySelector<HTMLElement>('.ProseMirror')
    pm?.focus()
  }

  return (
    <div ref={wrapperRef} className="textarea min-h-[400px]" onMouseDown={focusEditorUnlessToolbar}>
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
