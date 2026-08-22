'use client'
import { useRef } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { Node, Mark, mergeAttributes } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import Image from '@tiptap/extension-image'
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Minus, Image as ImageIcon } from 'lucide-react'

// Roll20 chat logs (this editor's main paste source) don't color text with
// inline <span style="color:..."> the way a hand-authored doc would —
// they color each *message* by wrapping it in a <div class="message ...">
// with its own background-color (blue for the pasting user's lines, gray
// for others, tan for emotes), full-width, one row per message — and
// render dice rolls as full <table>s inside those same divs. Two gaps this
// closes:
//
// 1. No table support at all (StarterKit doesn't include one) meant every
//    dice-roll table got flattened into one run-on paragraph of
//    concatenated cell text on paste — the original "shown as plain text"
//    bug report.
// 2. Nothing carried the per-message background forward at all, so
//    speakers were only distinguishable by the bold name label.
//
// First attempt at #2 used a Mark (an inline highlight around just the
// message's text) rather than a real block — cheaper to write, since a
// mark's parseHTML rule applies to every text node beneath the matching
// element regardless of what block it lands in. But visually that's a
// padded highlight hugging the text, not the full-width row Roll20
// actually renders, and it doesn't stop adjacent div.message elements from
// merging into one shared paragraph (nothing forces a block boundary
// between them once the div itself isn't mapped to a node). A real block
// node fixes both: each div.message becomes its own node instance no
// matter what's next to it, and the background renders on that node's own
// wrapping element — a true full-bleed row. `content: 'block+'` (not
// 'inline*') is what makes this handle both shapes of message: plain-text
// ones get an implicit paragraph wrapped around their loose inline
// content, same as at the document root, and roll-template ones — whose
// content is a nested table, not text — accept that table directly, since
// table is itself a 'block'.
const TrpgMessage = Node.create({
  name: 'trpgMessage',
  group: 'block',
  content: 'block+',
  defining: true,
  // Without this, the FIRST message of a paste (the one landing where the
  // cursor already sits, e.g. the editor's initial empty paragraph) gets
  // merged into that surrounding paragraph instead of becoming its own
  // trpgMessage — confirmed by hand: every message after the first got its
  // own colored block, but the first one silently lost its wrapper and
  // came out as plain unstyled text. `isolating` tells ProseMirror this
  // node's boundary can't be crossed by that kind of paste/replace
  // merging, so it always becomes (or stays) its own block.
  isolating: true,
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.backgroundColor || null,
        renderHTML: (attrs: { color: string | null }) =>
          attrs.color ? { style: `background-color: ${attrs.color}` } : {},
      },
      // Scene-narration ("desc") and transition ("emote") messages are
      // center-aligned in Roll20 — carried forward the same way as color,
      // a separate attribute independently contributing to the rendered
      // div's `style`; Tiptap merges every attribute's own `style` output
      // into one combined attribute automatically, so this and `color`
      // above don't need to be reconciled by hand.
      align: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.textAlign || null,
        renderHTML: (attrs: { align: string | null }) =>
          attrs.align ? { style: `text-align: ${attrs.align}` } : {},
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div.message' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'trpg-message' }), 0]
  },
  // Roll20 wraps the avatar in its own `<div class="avatar">…</div>`,
  // sitting right before the `<span class="by">` name — and a `<div>`
  // with no matching parse rule always triggers ProseMirror's implicit
  // block-boundary heuristic (same mechanism that used to split every
  // div.message into its own paragraph before the node above existed),
  // regardless of what's inside it. Confirmed by hand: with the Image
  // extension alone, the avatar landed in its own paragraph ABOVE the
  // name/text line instead of inline before it. transformPastedHTML runs
  // on the raw pasted HTML *string*, before any of that block-detection
  // happens, so unwrapping the div here — leaving the bare <img> in the
  // same spot — is what keeps it inline with the name on one line.
  //
  // Second replace hoists a roll-template's <caption> out from inside its
  // <table> to a sibling <div> right before it. First attempt gave Table
  // its own content model with an optional caption slot instead
  // ('trpgTableCaption? tableRow+') — confirmed by hand that this corrupts
  // prosemirror-tables' own column-count bookkeeping (every row came out
  // padded with extra phantom empty cells that weren't in the source).
  // That plugin's invariants aren't designed around a caption sharing the
  // table's content, so working around it at the DOM-string level instead
  // — caption becomes an ordinary top-level block, table's schema is
  // untouched — sidesteps that whole class of bug rather than fighting it.
  //
  // Third: Roll20's ending-credits "cards" (BIG SECRET / Actor / Sponsor…)
  // paint a black bar via one completely empty
  // <a style="background:black;...display:block;height:15pt">...</a>,
  // then overlay 1-2 label anchors ON it via position: absolute + large
  // negative margins (e.g. "END 1" and "BIG SECRET" both sitting on that
  // one bar). This went through three straight attempts to preserve that
  // exact mechanism faithfully — each one fixed the symptom in front of it
  // and broke something else, confirmed by hand every time:
  //   1. Preserving the styles as-is: the empty bar has no text for a Mark
  //      to attach to, so it silently vanished during parsing — label text
  //      with no backdrop at all, illegible.
  //   2. Injecting &nbsp; so the bar survives as a real (blank) marked
  //      run, plus re-enabling position/margin in SAFE_STYLE_PROPS so the
  //      labels actually overlay it: worked in isolation, but once the
  //      editor itself became a fixed-height scrollable box, the FIRST
  //      such card's overshoot had no adjacent content above it to land
  //      on and got clipped by the scroll container's own edge.
  //   3. Adding top padding as a landing buffer for that overshoot: fixed
  //      #2, but consecutive credits rows sit flush against each other (no
  //      gap, by design — see the comment above), so each row's overshoot
  //      bled UP into the previous row's rendered space instead — visibly
  //      garbled/overlapping text, reported directly.
  //   4. Tried scoping `overflow: hidden` to just these rows to contain
  //      the bleed: over-corrected — that also clips the label anchors'
  //      OWN necessary overshoot (they position themselves via the same
  //      negative-margin mechanism), so nothing rendered at all.
  // Four rounds converging on the same conclusion: this specific Roll20
  // technique — an out-of-flow overlay calibrated against Roll20's own
  // exact padding/stacking context — doesn't have a stable equivalent in
  // an editor with a different padding scheme, adjacency behavior, AND a
  // scroll boundary Roll20's own page never had. Rather than a fifth
  // attempt at the same mechanism, this replaces the whole empty-bar-plus-
  // overlay-labels group with a single ordinary flex row at parse time —
  // ordinary document flow, nothing absolutely positioned, nothing that
  // can clip or bleed into a neighbor by construction. Trades exact
  // pixel-for-pixel label placement for something that is simply correct
  // regardless of what's adjacent to it. A DOM-based pass, not another
  // regex — reading text content and matching "is this the next sibling"
  // is significantly more reliable here than a string pattern would be
  // for a group of a variable 1-2 elements.
  //
  // Kept in the same pass: any OTHER completely empty styled element (not
  // part of the credits pattern above, if Roll20 uses this "empty box for
  // color" trick anywhere else) still gets the non-breaking-space fallback
  // — same reasoning as before, just done via the DOM instead of a regex.
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          transformPastedHTML(html: string) {
            const withStrings = html
              .replace(/<div[^>]*\bclass="avatar"[^>]*>([\s\S]*?)<\/div>/g, '$1')
              .replace(
                /<table([^>]*)>\s*<caption([^>]*)>([\s\S]*?)<\/caption>/g,
                (_match, tableAttrs, captionAttrs, captionContent) =>
                  `<div class="trpg-table-caption"${captionAttrs}>${captionContent}</div><table${tableAttrs}>`
              )

            const doc = new DOMParser().parseFromString(`<div id="trpg-paste-root">${withStrings}</div>`, 'text/html')
            const root = doc.getElementById('trpg-paste-root')
            if (!root) return withStrings

            root.querySelectorAll('a, span').forEach(bar => {
              const style = bar.getAttribute('style') || ''
              if (!/background-color:\s*black/i.test(style)) return
              if ((bar.textContent || '').trim() !== '') return // must be the empty bar itself, not a label
              const labels: Element[] = []
              let sibling = bar.nextElementSibling
              while (sibling && /position:\s*absolute/i.test(sibling.getAttribute('style') || '')) {
                labels.push(sibling)
                sibling = sibling.nextElementSibling
              }
              if (labels.length === 0) return
              const row = doc.createElement('div')
              row.className = 'trpg-credit-row'
              labels.forEach(label => {
                const span = doc.createElement('span')
                span.textContent = label.textContent || ''
                const labelStyle = label.getAttribute('style') || ''
                // Anchored to a declaration boundary (start-of-string or a
                // preceding `;`), not a bare substring search — `color:`
                // unanchored also matches inside `background-color:`,
                // confirmed by hand: every label came out with its
                // *background*'s value (usually "transparent") applied as
                // its text color instead of its real one.
                const kept: string[] = []
                for (const prop of ['color', 'font-size', 'font-weight', 'font-style']) {
                  const m = new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`, 'i').exec(labelStyle)
                  if (m) kept.push(`${prop}: ${m[1].trim()}`)
                }
                span.setAttribute('style', kept.join('; '))
                row.appendChild(span)
              })
              bar.replaceWith(row)
              labels.forEach(label => label.remove())
            })

            // Scene-divider illustrations (embedded between narration
            // beats) aren't <img> tags at all — Roll20 paints them via
            // `background-image: url(...)` on an empty <a>, sized purely
            // by padding (padding: 55px 85px here, no width/height). That
            // property was never in SAFE_STYLE_PROPS, and even adding it
            // wouldn't be enough on its own: a background-image needs a
            // real box to paint into, same "empty element has no box"
            // problem as the credits black bar above, just via a
            // different CSS property. Converting straight to a real <img>
            // sidesteps that entirely — an <img> paints itself, no
            // borrowed box needed.
            root.querySelectorAll('a[style*="background-image"], span[style*="background-image"]').forEach(el => {
              const style = el.getAttribute('style') || ''
              const match = /background-image:\s*url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/i.exec(style)
              const url = match?.[1] || match?.[2] || match?.[3]
              if (!url) return
              const img = doc.createElement('img')
              img.setAttribute('src', url)
              img.className = 'trpg-content-image'
              el.replaceWith(img)
            })

            // Roll20 pads real vertical space around a scene-divider image
            // with two more <a> tags that are the *same* link, carrying no
            // real content (a literal "-") made invisible via opacity: 0 —
            // pure spacing, not part of the log. Without dropping these,
            // they'd survive as real, visible, clickable dashes (opacity
            // isn't safe to reapply blindly the way it's used here, so
            // it's not in SAFE_STYLE_PROPS either) sitting right next to
            // the image they used to invisibly pad.
            root.querySelectorAll('a').forEach(el => {
              if ((el.textContent || '').trim() === '-' && /opacity:\s*0/i.test(el.getAttribute('style') || '')) {
                el.remove()
              }
            })

            root.querySelectorAll('a[style], span[style]').forEach(el => {
              if ((el.textContent || '').trim() === '' && el.children.length === 0) {
                el.textContent = ' '
              }
            })

            return root.innerHTML
          },
        },
      }),
    ]
  },
})

// Roll20's roll-template tables (the "굴림"/"판정결과" boxes) carry almost
// all of their visual identity as literal inline style="..." — a black
// caption bar, per-row/per-cell background (the pass/fail row's gray
// label + green result), bordered "chip" styling on each rolled number,
// cell text-alignment. Rather than keep adding one more curated attribute
// every time another Roll20-specific property turns out to matter, this
// captures the whole style attribute verbatim on table/row/cell/caption
// elements and styled inline spans/links, filtered to an allowlist of
// properties safe to reapply outside Roll20's own page layout — as
// permissive as it can be while still excluding the one property
// confirmed (by hand) to actively break something reapplied here: Roll20's
// own `width: 1361px` (their chat panel's literal pixel width — would
// blow out our layout if reapplied).
//
// position/top/left/right/bottom/z-index and width/height are excluded —
// Roll20's own `width: 1361px` (their chat panel's literal pixel width)
// would blow out our layout if reapplied, and position was the mechanism
// behind an out-of-flow overlay trick (see the long comment on
// TrpgMessage's transformPastedHTML) that turned out to have no stable
// equivalent in an editor with different padding/adjacency/scroll
// behavior than Roll20's own page — that content gets restructured into
// ordinary flow at paste time instead of relying on position surviving to
// the schema at all, so keeping it in this whitelist wouldn't even do
// anything for that case anymore, only reintroduce a minor side effect
// elsewhere (the avatar-adjacent name span's own leftover `left: -5px`,
// meaningless now that the avatar sits inline rather than in Roll20's
// absolutely-positioned gutter).
const SAFE_STYLE_PROPS = new Set([
  'background', 'background-color', 'color',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius',
  'padding', 'margin', 'text-align', 'text-decoration', 'vertical-align',
  'font-weight', 'font-style', 'font-size', 'line-height', 'letter-spacing',
  'min-width', 'display', 'cursor',
])

function sanitizeStyle(raw: string | null): string | null {
  if (!raw) return null
  const kept = raw.split(';')
    .map(rule => rule.trim())
    .filter(Boolean)
    .filter(rule => SAFE_STYLE_PROPS.has(rule.split(':')[0]?.trim().toLowerCase() ?? ''))
  return kept.length ? kept.join('; ') : null
}

const styleAttribute = {
  style: {
    default: null,
    parseHTML: (el: HTMLElement) => sanitizeStyle(el.getAttribute('style')),
    renderHTML: (attrs: { style: string | null }) =>
      (attrs.style ? { style: attrs.style } : {}),
  },
}

// Tiptap's Table extension has no caption support at all (prosemirror-
// tables' schema helper it's built on doesn't define one), and — per the
// comment on TrpgMessage's paste plugin above — giving Table its own
// content model to add one broke its column-count bookkeeping. This is a
// plain top-level block instead: TrpgMessage's transformPastedHTML already
// hoists the caption out of the <table> into a sibling `div.trpg-table-
// caption` right before it, so this just needs to render that div — no
// relationship to Table's schema at all, nothing for prosemirror-tables to
// get confused by.
const TrpgTableCaption = Node.create({
  name: 'trpgTableCaption',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return { ...styleAttribute }
  },
  parseHTML() {
    return [{ tag: 'div.trpg-table-caption' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'trpg-caption' }), 0]
  },
})

// The flex-row replacement TrpgMessage's transformPastedHTML builds for
// Roll20's ending-credits label-overlay pattern (see the long comment
// there) needs the exact same treatment as TrpgTableCaption right above —
// a `<div class="trpg-credit-row">` with no matching node/parseHTML rule
// isn't neutral, it's actively wrong: confirmed by hand, ProseMirror has
// no idea what to do with an unrecognized div and silently drops the
// wrapper entirely, keeping only its (mark-wrapped) children — the exact
// same "unwrap" behavior document earlier for div.avatar and div.message
// before those got their own nodes. Building the replacement HTML string
// correctly in the paste transform was necessary but not sufficient
// without also giving it real schema representation here.
const TrpgCreditRow = Node.create({
  name: 'trpgCreditRow',
  group: 'block',
  content: 'inline*',
  parseHTML() {
    return [{ tag: 'div.trpg-credit-row' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'trpg-credit-row' }), 0]
  },
})

const TableWithStyle = Table.extend({
  addAttributes() {
    return { ...this.parent?.(), ...styleAttribute }
  },
})
const TableRowWithStyle = TableRow.extend({
  addAttributes() {
    return { ...this.parent?.(), ...styleAttribute }
  },
})
const TableHeaderWithStyle = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...styleAttribute }
  },
})
const TableCellWithStyle = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...styleAttribute }
  },
})

// The bordered gray "chip" around each rolled number (75, 37, 15…) is a
// plain <span style="background:...;border:...;padding:...">, not
// anything with its own class we can key a dedicated node/mark off of the
// way trpgMessage keys off div.message — a generic style-carrying mark on
// any styled span is what actually reaches it. Applies inside table cells
// too, same as any mark: ProseMirror marks apply per inline content
// regardless of which block/cell that content ends up in.
//
// Also matches styled <a> — Roll20 uses plain <a style="..."> (no href at
// all) as a styling hook for its own scene-title/credit "cards" (black
// background, white bold centered text), not just for real links. Those
// have no href for StarterKit's own Link mark to key off (it only matches
// a[href]), so without this rule they fell through both marks and lost
// all their styling — same class of gap as the roll-chip spans, just on a
// different tag. A real <a href> gets both marks at once (Link keeps the
// href/target functional, this keeps the visual styling) and nests fine —
// independent marks on the same text always can.
const RawSpanStyle = Mark.create({
  name: 'rawSpanStyle',
  addAttributes() {
    return { ...styleAttribute }
  },
  parseHTML() {
    return [{ tag: 'span[style]' }, { tag: 'a[style]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0]
  },
})

// The extension set is shared between the editable form here and the
// read-only render on the detail page (TrpgSessionView) — same schema on
// both ends, so what got typed/pasted in is exactly what renders back out,
// nothing silently dropped on one side.
export const TRPG_EXTENSIONS = [
  StarterKit,
  TextStyle,
  Color,
  TableWithStyle.configure({ resizable: false }),
  TableRowWithStyle,
  TableHeaderWithStyle,
  TableCellWithStyle,
  TrpgTableCaption,
  TrpgCreditRow,
  RawSpanStyle,
  TrpgMessage,
  // `inline: true` so the avatar lands as the first bit of running text in
  // its message (right before the bold speaker name) rather than as a
  // block of its own — Roll20 actually absolute-positions the avatar in a
  // left gutter next to the text, but reproducing that inside a rich-text
  // schema (a node needing its own out-of-flow position without disrupting
  // the surrounding paragraph's content model) is real structural surgery
  // for a cosmetic difference; inline-before-the-name reads close enough
  // and every avatar this editor will ever see arrives this same way, via
  // paste — there's no toolbar button offering it as an authored option.
  //
  // Roll20's own avatar <img> declares its real size inline
  // (max-width: 28px; height: auto; max-height: 28px) — capturing that
  // (unfiltered; width/height are exactly what we want honored here,
  // unlike on the table where the same properties were the actively
  // dangerous ones) means it renders at Roll20's own intended size instead
  // of a guessed one of ours. `.trpg-content img`'s own CSS still supplies
  // the *fallback* size plus the circular crop treatment neither this nor
  // Roll20's inline style carries (Roll20 gets that from an external
  // stylesheet rule paste can't see at all, keyed off .avatar img — not
  // present in what's captured here regardless of filtering) — inline
  // style wins per-property over that CSS on whatever it does specify, so
  // the two combine rather than one replacing the other outright.
  // `class` is captured too, not just `style` — it's how a scene-divider
  // image (built from a background-image div during paste, see
  // TrpgMessage's transformPastedHTML) gets tagged `trpg-content-image`
  // so globals.css can give it real illustration sizing instead of the
  // small circular avatar-chip treatment `.trpg-content img` applies by
  // default. Without an attribute explicitly capturing it, Tiptap drops
  // any HTML attribute a node's schema doesn't know about during parsing
  // — same class of gap as trpgTableCaption/trpgCreditRow needing their
  // own node instead of just being well-formed HTML in the paste output.
  Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        style: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute('style'),
          renderHTML: (attrs: { style: string | null }) =>
            (attrs.style ? { style: attrs.style } : {}),
        },
        class: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute('class'),
          renderHTML: (attrs: { class: string | null }) =>
            (attrs.class ? { class: attrs.class } : {}),
        },
      }
    },
  }).configure({ inline: true }),
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
      {/* Pasted images (an avatar, or a scene-divider illustration
          rebuilt from Roll20's own background-image div — see
          TrpgMessage's transformPastedHTML) sometimes need to point
          somewhere else: the original CDN link expired, or the admin
          wants their own art in the slot instead. window.prompt, not a
          modal — matches this app's existing lightweight pattern for a
          single-field ask (see DeleteSessionButton's window.confirm). */}
      <ToolbarButton
        label="Replace image"
        active={false}
        onClick={() => {
          if (!editor.isActive('image')) {
            window.alert('Click an image in the log first, then use this to swap its URL.')
            return
          }
          const current = (editor.getAttributes('image').src as string | undefined) ?? ''
          const url = window.prompt('New image URL:', current)
          if (!url) return
          editor.chain().focus().updateAttributes('image', { src: url }).run()
        }}
      >
        <ImageIcon size={13} />
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
  // first, nowhere near this box's own height — so most of what visually
  // reads as "the text field" isn't part of it at all, and clicking there
  // focuses nothing (looks exactly like a broken input). Tried making the
  // wrapper around EditorContent flex-1/h-full to grow the actual
  // clickable region to match — the height never propagated down through
  // Tiptap's own internal wrapper div to the real .ProseMirror element, so
  // that click still landed outside it. Handling the click at the outer
  // box level instead sidesteps that entirely: it only needs THIS div's
  // own height, with an explicit bail-out for clicks that started on a
  // toolbar button so this can't fire after — and undo — a button's own
  // focus-and-format action.
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

  // Fixed height + internal scroll, not min-h-[400px] (unbounded growth) —
  // a long pasted Roll20 log used to make the whole box grow to match it,
  // pushing everything below (the rest of the page, the Save/Cancel
  // buttons) further and further down instead of staying put. Toolbar
  // sits outside the scrolling region (own flex item, not inside the
  // overflow-y-auto div) so it stays reachable/visible regardless of
  // scroll position, matching how a normal fixed-toolbar editor behaves.
  // min-h-0 on the scroll region is load-bearing, not decorative — a flex
  // child's default min-height is `auto` (roughly "as tall as its
  // content wants"), which silently defeats overflow-y-auto by letting
  // the child grow past its flex-basis instead of scrolling.
  return (
    <div ref={wrapperRef} className="textarea flex flex-col h-[400px] overflow-hidden" onMouseDown={focusEditorUnlessToolbar}>
      <Toolbar editor={editor} />
      {/* pt-5 (20px) isn't decorative spacing — it's a buffer against a
          real clipping bug the scroll container itself introduces.
          Roll20's ending-credits cards render via a negative top margin
          (captured in SAFE_STYLE_PROPS) that pulls their black background
          bar upward to overshoot its own row — harmless in unconstrained
          page flow, which is the only context Roll20 itself ever renders
          it in. Once this region became scrollable (overflow-y-auto),
          that boundary is real: confirmed by hand that the first such
          card, with nothing above it to absorb the overshoot, got its bar
          clipped down to a sliver against the container's own top edge.
          20px of top padding gives that overshoot somewhere to land
          instead of hitting the edge — matches the -20px these cards
          consistently use in practice closely enough that it isn't
          noticeably visible as its own gap. */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-5">
        <EditorContent editor={editor} className="trpg-content trpg-editable" />
      </div>
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
