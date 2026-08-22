'use client'
import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper, type Editor, type NodeViewProps } from '@tiptap/react'
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
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Minus, Image as ImageIcon, Users, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage } from '@/lib/upload'

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
      // Roll20's div.spacer (the thin colored line above a message) used
      // to become its own TrpgSpacer block node, sitting between the
      // avatar and the rest of the message's content — but a block
      // element there forces ProseMirror to split the avatar into its
      // OWN paragraph, separate from the text that follows it (confirmed
      // by hand: reported directly as "icon and content are separated by
      // the divider when they're supposed to be on the same line"). A
      // border-top on the message itself achieves the same visual line
      // without interrupting the flow at all — avatar and text stay in
      // one paragraph together, exactly like Roll20's own non-absolute-
      // positioned rendering of this same content. transformPastedHTML
      // pulls div.spacer's own background-color onto the parent message
      // div's style (as border-top-color) and removes the spacer element
      // entirely before this ever reaches parsing — see that DOM pass for
      // where el.style.borderTopColor actually gets set from.
      dividerColor: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.borderTopColor || null,
        renderHTML: (attrs: { dividerColor: string | null }) =>
          attrs.dividerColor
            ? { style: `border-top: 2px solid ${attrs.dividerColor}; padding-top: 7px` }
            : {},
      },
      // A message that resolves to just a credit row (see TrpgCreditRow)
      // sets its own padding to 0 via transformPastedHTML so that row's
      // black background reaches every edge with no gray margin from
      // `.trpg-message`'s own base px-3 pb-2 showing through around it —
      // but that plain DOM mutation only survives the FIRST, string-level
      // transform pass. Without an attribute here to capture and re-emit
      // it, the real schema parser that runs next has nothing telling it
      // "padding" is a property this node cares about, so it drops it
      // silently on the floor — same class of bug as color/align/
      // dividerColor above needing their own attribute, confirmed by
      // hand: the gray margin was reported as still visible even after
      // the DOM-level fix, because it never actually made it past parsing.
      flushPadding: {
        default: false,
        parseHTML: (el: HTMLElement) => el.style.padding === '0px' || el.style.padding === '0',
        renderHTML: (attrs: { flushPadding: boolean }) =>
          (attrs.flushPadding ? { style: 'padding: 0' } : {}),
      },
    }
  },
  parseHTML() {
    // Two rules, not one: `div.message` matches Roll20's own raw class on
    // a fresh paste, but this node's own renderHTML below serializes it
    // back out as `class="trpg-message"` — and that's what every SAVED
    // session's body actually contains once it round-trips through the
    // database. Without `div.trpg-message` here too, re-loading that saved
    // HTML (the read-only detail view, or reopening the edit page) doesn't
    // match either rule against "trpg-message" as a class token, so
    // ProseMirror silently unwraps the div and drops its color/align style
    // — same unwrap bug documented elsewhere in this file for a missing
    // parseHTML rule, just triggered by save/reload instead of paste.
    return [{ tag: 'div.message' }, { tag: 'div.trpg-message' }]
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
              // Unwrap div.avatar (see the long comment above) AND tag the
              // <img> it contains `trpg-avatar` in the same pass — that
              // class is what tells globals.css's `.trpg-content img.trpg-
              // avatar` rule to render this one small and square instead
              // of at native resolution like every other image (the new
              // default — see that rule's own comment for why this is the
              // one image type that has to opt IN instead of out).
              .replace(/<div[^>]*\bclass="avatar"[^>]*>([\s\S]*?)<\/div>/g, (_match, inner) =>
                inner.replace(/<img /, '<img class="trpg-avatar" ')
              )
              // Speaker name + colon (`<span class="by">이름:</span>`) isn't
              // reliably followed by a space in Roll20's own source — some
              // message types have one, some run straight into the message
              // text with none at all ("이름:재미 있어 보이네." reported
              // directly). Normalizing to exactly one space here, replacing
              // whatever whitespace (none, one, or more) actually followed
              // the span, guarantees the gap regardless of what the source
              // had.
              .replace(/(<span class="by">[\s\S]*?<\/span>)\s*/g, '$1 ')
              .replace(
                /<table([^>]*)>\s*<caption([^>]*)>([\s\S]*?)<\/caption>/g,
                (_match, tableAttrs, captionAttrs, captionContent) =>
                  `<div class="trpg-table-caption"${captionAttrs}>${captionContent}</div><table${tableAttrs}>`
              )

            const doc = new DOMParser().parseFromString(`<div id="trpg-paste-root">${withStrings}</div>`, 'text/html')
            const root = doc.getElementById('trpg-paste-root')
            if (!root) return withStrings

            // div.spacer (see TrpgMessage's dividerColor attribute for why
            // this exists) isn't kept as its own element at all — its
            // background-color moves onto the parent message div's own
            // style as border-top-color, and the spacer div itself is
            // removed. Done here rather than via a Node/parseHTML rule
            // (which is how this worked before) specifically so nothing
            // block-level sits between the avatar and the message's text
            // content any more, letting them share one paragraph.
            root.querySelectorAll('div.spacer, div.trpg-spacer').forEach(spacer => {
              const message = spacer.parentElement
              const color = (spacer as HTMLElement).style.backgroundColor
              if (message && color) {
                (message as HTMLElement).style.borderTopColor = color
              }
              spacer.remove()
            })

            root.querySelectorAll('a, span').forEach(bar => {
              const style = bar.getAttribute('style') || ''
              if (!/background-color:\s*black/i.test(style)) return
              if ((bar.textContent || '').trim() !== '') return // must be the empty bar itself, not a label
              const labels: Element[] = []
              let sibling = bar.nextElementSibling
              // Tag name AND non-empty text, not just position:absolute —
              // Roll20's own hover-menu trigger (div#menu-…, class="flyout",
              // right after the real labels in the source) also carries
              // position:absolute for its own unrelated reason, and got
              // swept in here as a bogus third "label" with no text,
              // confirmed by hand: it broke the flex row into an
              // [actual labels] + [empty nbsp-padded span] pair instead of
              // the intended two side-by-side labels.
              while (
                sibling &&
                /^(a|span)$/i.test(sibling.tagName) &&
                /position:\s*absolute/i.test(sibling.getAttribute('style') || '') &&
                (sibling.textContent || '').trim() !== ''
              ) {
                labels.push(sibling)
                sibling = sibling.nextElementSibling
              }
              if (labels.length === 0) return
              const row = doc.createElement('div')
              row.className = 'trpg-credit-row'
              labels.forEach(label => {
                // A dedicated NODE (trpg-credit-label), not a plain marked
                // <span> — two labels sharing an identical mark value (both
                // happened to have the same `color`) got serialized under
                // ONE shared outer wrapper for that mark, confirmed by
                // hand: it collapsed what should be two separate flex
                // children into one, breaking the side-by-side layout
                // entirely (both labels' text ran together with no gap).
                // Nodes never merge like that regardless of matching
                // attributes, only marks do.
                const labelEl = doc.createElement('div')
                labelEl.className = 'trpg-credit-label'
                labelEl.textContent = label.textContent || ''
                const labelStyle = label.getAttribute('style') || ''
                // Anchored to a declaration boundary (start-of-string or a
                // preceding `;`), not a bare substring search — `color:`
                // unanchored also matches inside `background-color:`,
                // confirmed by hand: every label came out with its
                // *background*'s value (usually "transparent") applied as
                // its text color instead of its real one. Hand-curated to
                // exactly these four properties, not the SAFE_STYLE_PROPS
                // whitelist used elsewhere in this file — that whitelist
                // still allows margin/position-adjacent properties this
                // label's own source style carries (calibrated for
                // Roll20's absolute-positioned overlay, the exact
                // mechanism this flex-row rewrite exists to avoid), which
                // would reintroduce the same layout breakage on a
                // different node type.
                const kept: string[] = []
                for (const prop of ['color', 'font-size', 'font-weight', 'font-style']) {
                  const m = new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`, 'i').exec(labelStyle)
                  if (m) kept.push(`${prop}: ${m[1].trim()}`)
                }
                labelEl.setAttribute('style', kept.join('; '))
                row.appendChild(labelEl)
              })
              // Roll20 renders a run of these credit cards as ONE
              // continuous black block — achieved in its own markup via
              // each bar bleeding out over its message's own padding via
              // negative margins (the very overlay trick this flex row
              // replaces). Without that overlap, EVERY side of the
              // message's own padding shows through as a visible
              // light-gray frame around the black row instead of the row
              // filling the box edge-to-edge: the spacer-derived divider
              // on top (cleared below), but ALSO `.trpg-message`'s own
              // base `px-3 pb-2` from its CSS class on the left/right/
              // bottom — confirmed by hand, reported directly as a gray
              // boundary still visible around the box even after the top
              // divider was fixed. `padding: 0` inline beats that class
              // outright (inline style always wins over any stylesheet
              // rule regardless of selector specificity), so the row's
              // own black background reaches every edge of the message.
              const message = bar.closest('div.message, div.trpg-message')
              if (message instanceof HTMLElement) {
                message.style.removeProperty('border-top-color')
                message.style.removeProperty('border-top')
                message.style.padding = '0'
                // Capping .trpg-credit-row's own width (globals.css) so
                // its label pair doesn't spread across this app's whole
                // (much wider than Roll20's own chat panel) content
                // column reopens the exact gray-margin gap the padding:0
                // above just closed, UNLESS the space around that now-
                // narrower row is ALSO black — reusing TrpgMessage's
                // existing `color` (background) attribute for that,
                // rather than adding yet another one, since this is
                // still just "set the message's own background color,"
                // the same thing that attribute already does for every
                // other message.
                message.style.backgroundColor = 'black'
              }
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
    // Two rules, not one — same fix, same reason, as TrpgMessage's own
    // parseHTML above: `div.trpg-table-caption` matches the div this
    // node's paste-time transform hoists out of the table, but renderHTML
    // below serializes it back out as `class="trpg-caption"` — a
    // DIFFERENT class name — and that's what a saved session's body
    // actually contains once it round-trips through the database.
    // Without `div.trpg-caption` here too, reloading that saved HTML (the
    // read-only detail view, or reopening the edit page) doesn't match
    // either rule, so ProseMirror silently unwraps the div and drops its
    // black-background/white-text caption styling — confirmed by hand,
    // this is exactly what made a saved caption render as plain unstyled
    // text instead of a caption bar.
    return [{ tag: 'div.trpg-table-caption' }, { tag: 'div.trpg-caption' }]
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
// One label within a credit row — its own node (not an inline mark),
// specifically so two labels can never merge into one rendered element
// just because they happen to share an identical style property (see the
// long comment on TrpgMessage's transformPastedHTML, "a dedicated NODE,
// not a plain marked <span>", for the exact bug this fixes). content model
// references it by name below, not via a shared group, so nothing else
// can end up inside a credit row.
const TrpgCreditLabel = Node.create({
  name: 'trpgCreditLabel',
  content: 'inline*',
  addAttributes() {
    return { ...styleAttribute }
  },
  parseHTML() {
    return [{ tag: 'div.trpg-credit-label' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'trpg-credit-label' }), 0]
  },
})

const TrpgCreditRow = Node.create({
  name: 'trpgCreditRow',
  group: 'block',
  content: 'trpgCreditLabel+',
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

// Star overlay for picking a session's list-page cover image — every
// <img> in the log goes through this NodeView (a plain schema-rendered
// <img> can't host an interactive React button inside it), but the
// avatar specifically opts out: a speaker's tiny 28px chip was never a
// candidate for "the session's cover art" the way a scene illustration
// or an uploaded picture is, and showing a star on every single avatar
// throughout a hundred-message log would be pure visual noise. Hidden
// in read-only rendering (TrpgSessionView, editable: false) — this is an
// authoring affordance, not something a visitor reading the published
// page should see or be able to click.
//
// style is applied via a plain DOM .setAttribute, not React's style
// prop — Roll20's own captured style lives as a raw CSS *string*
// (verbatim, unfiltered, see the Image.extend() comment below), and
// that's exactly what a schema-rendered <img> already does under the
// hood (ProseMirror's DOM serializer sets the attribute directly, it
// doesn't go through React at all). Parsing that string into a React
// style object just to hand it back as a string would be extra work
// for an identical result, with more chances to get some CSS shorthand
// wrong along the way.
function TrpgImageView({ node, editor, getPos }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    if (node.attrs.style) img.setAttribute('style', node.attrs.style)
    else img.removeAttribute('style')
  }, [node.attrs.style])

  const isAvatar = node.attrs.class === 'trpg-avatar'
  const isCover = !!node.attrs.cover

  // One transaction, one pass over the whole doc — deliberately NOT
  // editor.commands.updateAttributes for this node's own flag, which
  // operates on whatever the CURRENT SELECTION happens to be, not on
  // this specific node view instance; clicking the star doesn't select
  // the image first, so that would silently touch the wrong node (or
  // nothing) whenever the selection was sitting somewhere else. Matching
  // on getPos() directly is the only reliable way to mean "this exact
  // image" regardless of selection state.
  function toggleCover(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const pos = getPos()
    const { state, view } = editor
    let tr = state.tr
    state.doc.descendants((n, p) => {
      if (n.type.name !== 'image') return
      if (p === pos) tr = tr.setNodeMarkup(p, undefined, { ...n.attrs, cover: !isCover })
      else if (n.attrs.cover) tr = tr.setNodeMarkup(p, undefined, { ...n.attrs, cover: false })
    })
    view.dispatch(tr)
  }

  return (
    <NodeViewWrapper as="span" className={isAvatar ? '' : 'relative inline-block group/cover'} draggable data-drag-handle>
      <img ref={imgRef} src={node.attrs.src} alt={node.attrs.alt ?? ''} className={node.attrs.class || undefined} />
      {!isAvatar && editor.isEditable && (
        <button
          type="button"
          onClick={toggleCover}
          title={isCover ? 'Cover image — click to unset' : 'Set as session cover'}
          className={`absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-black/50 text-white transition-opacity ${
            isCover ? 'opacity-100' : 'opacity-0 group-hover/cover:opacity-100'
          }`}
        >
          <Star size={14} className={isCover ? 'fill-current' : ''} />
        </button>
      )}
    </NodeViewWrapper>
  )
}

export const TRPG_EXTENSIONS = [
  StarterKit,
  TextStyle,
  Color,
  TableWithStyle.configure({ resizable: false }),
  TableRowWithStyle,
  TableHeaderWithStyle,
  TableCellWithStyle,
  TrpgTableCaption,
  TrpgCreditLabel,
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
        // Which image (if any) the session-list grid uses as its cover —
        // see TrpgImageView's star button above. At most one image in the
        // whole document should carry this at a time (enforced there, not
        // here — a schema attribute has no way to constrain "only one
        // instance of this node may have this value").
        cover: {
          default: false,
          parseHTML: (el: HTMLElement) => el.getAttribute('data-cover') === 'true',
          renderHTML: (attrs: { cover: boolean }) =>
            (attrs.cover ? { 'data-cover': 'true' } : {}),
        },
      }
    },
    addNodeView() {
      return ReactNodeViewRenderer(TrpgImageView)
    },
  }).configure({ inline: true }),
]

type DetectedCharacter = { src: string; name: string; count: number }

// Groups every avatar in the current document by its own src — Roll20
// reuses one persistent image URL per speaker throughout a whole log, so
// two avatars sharing a src are, by construction, the same character;
// grouping by name text instead would be one more thing that could drift
// out of sync (typos, formatting marks) for no benefit. The display name
// shown in the picker is read separately, off whatever inline text
// follows the avatar within the same paragraph up to the first ':' —
// exactly the "이름:" shape TrpgMessage's own transformPastedHTML already
// assumes elsewhere in this file.
function detectAvatarCharacters(editor: Editor): DetectedCharacter[] {
  const groups = new Map<string, { name: string; count: number }>()
  editor.state.doc.descendants((node, _pos, parent, index) => {
    if (node.type.name !== 'image' || node.attrs.class !== 'trpg-avatar') return
    const src = node.attrs.src as string | null
    if (!src) return

    let name = ''
    if (parent) {
      for (let i = index + 1; i < parent.childCount; i++) {
        const text = parent.child(i).textContent
        const colonIndex = text.indexOf(':')
        if (colonIndex >= 0) { name += text.slice(0, colonIndex); break }
        name += text
      }
    }
    name = name.trim() || 'Unnamed'

    const existing = groups.get(src)
    if (existing) existing.count++
    else groups.set(src, { name, count: 1 })
  })
  return Array.from(groups.entries()).map(([src, g]) => ({ src, ...g }))
}

// Attribute-only rewrite (same node type, same content, no size change),
// so every position collected during the doc scan is still valid to
// apply against in one combined transaction — nothing shifts between
// collecting the positions and dispatching it.
function replaceAvatarSrc(editor: Editor, oldSrc: string, newSrc: string) {
  const { state, view } = editor
  let tr = state.tr
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'image' && node.attrs.class === 'trpg-avatar' && node.attrs.src === oldSrc) {
      tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: newSrc })
    }
  })
  view.dispatch(tr)
}

// Document-scoped only, by design — confirmed directly: each session's
// avatar substitutions apply just to that one post's already-pasted
// content, not a persistent character registry re-used across future
// pastes/sessions. Re-pasting the same campaign's log elsewhere starts
// from Roll20's own avatars again.
function CharacterManager({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [characters, setCharacters] = useState<DetectedCharacter[]>([])
  const [uploadingSrc, setUploadingSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingSrcRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as globalThis.Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function toggleOpen() {
    if (!open) setCharacters(detectAvatarCharacters(editor))
    setOpen(o => !o)
  }

  function startReplacement(src: string) {
    pendingSrcRef.current = src
    fileInputRef.current?.click()
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const oldSrc = pendingSrcRef.current
    if (!file || !oldSrc) return

    setUploadingSrc(oldSrc)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.alert('You must be signed in to upload images.'); setUploadingSrc(null); return }

    const { url, error } = await uploadImage(file, user.id, 'trpg-images')
    setUploadingSrc(null)
    if (error) { window.alert(error); return }
    if (!url) return

    replaceAvatarSrc(editor, oldSrc, url)
    setOpen(false)
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <ToolbarButton label="Characters" active={open} onClick={toggleOpen}>
        <Users size={13} />
      </ToolbarButton>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 w-64 card p-1.5 space-y-0.5 max-h-72 overflow-y-auto">
          {characters.length === 0 && (
            <p className="text-xs text-ink-400 px-2 py-1.5">No avatars in this log yet.</p>
          )}
          {characters.map(c => (
            <button
              key={c.src}
              type="button"
              onClick={() => startReplacement(c.src)}
              disabled={uploadingSrc === c.src}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-scroll-100 text-left disabled:opacity-50"
            >
              <img src={c.src} alt="" className="w-6 h-6 object-cover shrink-0" />
              <span className="flex-1 truncate text-sm text-ink">{c.name}</span>
              <span className="text-[11px] text-ink-400 shrink-0">
                {uploadingSrc === c.src ? 'Uploading…' : `${c.count}×`}
              </span>
            </button>
          ))}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChosen} className="sr-only" />
    </div>
  )
}

function ToolbarButton({ active, onClick, label, disabled, children }: {
  active: boolean
  onClick: () => void
  label: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={`pill ${active ? 'pill-active' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Captured at click time, not read back out of the input's onChange —
  // the native file picker is a modal dialog, and by the time it resolves
  // the editor's selection (which image, if any, is currently active) is
  // still whatever it was when the button was clicked, so there's nothing
  // to re-derive later; just closing over it here is simpler than
  // threading it through as extra input-element state.
  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // otherwise re-picking the same file fires no change event
    if (!file) return

    const isReplacing = editor.isActive('image')
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.alert('You must be signed in to upload images.'); setUploading(false); return }

    const { url, error } = await uploadImage(file, user.id, 'trpg-images')
    setUploading(false)
    if (error) { window.alert(error); return }
    if (!url) return

    if (isReplacing) {
      editor.chain().focus().updateAttributes('image', { src: url }).run()
    } else {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

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
      {/* Two jobs behind one button, told apart by whether the cursor is
          currently sitting on an existing image: click an image first and
          this uploads a replacement straight over it — for when a pasted
          image (an avatar, or a scene-divider illustration rebuilt from
          Roll20's own background-image div — see TrpgMessage's
          transformPastedHTML) points somewhere dead or the admin wants
          their own art in that slot instead. Otherwise it uploads and
          inserts a brand new image node at the cursor, for art that was
          never part of a Roll20 paste to begin with. Uploads to the
          trpg-images bucket (057_trpg_images_storage.sql) via the same
          uploadImage helper every other image field in the app uses —
          not a raw URL prompt, so the image is actually owned by this
          app rather than pointing at an external link that can die. */}
      <ToolbarButton label="Add image" active={false} disabled={uploading} onClick={() => fileInputRef.current?.click()}>
        <ImageIcon size={13} />
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChosen}
        className="sr-only"
      />
      {/* One entry per distinct avatar already in the log (grouped by
          image src — see detectAvatarCharacters), not per message: pick
          a character once here and every message using that same avatar
          gets the new picture in one pass, instead of hunting down and
          replacing each of what could be dozens of individual messages
          by hand with "Add image" above. Document-scoped only — see
          CharacterManager's own comment for why this doesn't persist
          past this one session's content. */}
      <CharacterManager editor={editor} />
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

// Called at submit time by both session forms, against the plain HTML
// string they already hold in state — not against a live editor
// instance, since the form components only ever see TrpgSessionEditor's
// content by string (its onChange prop), never the ProseMirror doc
// itself. Cheaper to compute once here than to thread a second "give me
// the current cover" callback down through that prop boundary just for
// this.
export function deriveCoverUrl(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.querySelector('img[data-cover="true"]')?.getAttribute('src') ?? null
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
    <div ref={wrapperRef} className="textarea flex flex-col h-[500px] overflow-hidden" onMouseDown={focusEditorUnlessToolbar}>
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
