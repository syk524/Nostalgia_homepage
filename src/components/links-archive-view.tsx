'use client'
import { useEffect, useState, type FormEvent } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUpRight, ExternalLink, GripVertical, PanelLeftClose, PanelLeftOpen, Plus, X } from 'lucide-react'
import { createLink, deleteLink, reorderLinks } from '@/lib/actions/archive-links'
import { DotMatrixLoader } from '@/components/dot-matrix-loader'
import { ArchiveSectionTabs } from '@/components/archive-side-nav'
import type { ArchiveLink } from '@/types/database'

// Google's own edit/view URLs (docs.google.com/{type}/d/{id}/edit) send
// X-Frame-Options and refuse to render in anyone else's iframe — the
// /preview (or /embed for Slides) path is the one Google built FOR
// embedding, and unlike the edit URL it still renders inside a frame
// for a signed-out or unauthorized viewer: it shows Google's own
// sign-in / request-access screen inline instead of just going blank.
// Links to anything other than Docs/Sheets/Slides/Forms pass through
// unchanged — some of those may still refuse to frame, which is what
// the "Open in new tab" fallback below is for.
function getEmbedUrl(url: string): string {
  const match = url.match(/^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation|forms)\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) return url
  const [, type, id] = match
  if (type === 'forms') return `https://docs.google.com/forms/d/${id}/viewform?embedded=true`
  return `https://docs.google.com/${type}/d/${id}/${type === 'presentation' ? 'embed' : 'preview'}`
}

// Drag-reorder for the expanded/mobile list — the collapsed rail's own
// icon list stays static, since a drag gesture on a 32px icon column
// with no visible label to confirm what's being moved isn't a usable
// affordance the way it is with a full title row. Shared between
// desktop's expanded panel and the mobile page list (both render this
// same component, in their own separate DndContext) — the two differ
// only in what clicking the title actually does: desktop selects the
// link into the preview iframe alongside it; mobile has no preview
// pane at all, so it opens the link directly instead. That's a real
// behavior difference, not just a style one, so it's two separate
// elements below (one hidden per breakpoint) rather than one button
// branching its onClick — CSS can't do that part.
function SortableLinkRow({
  link, selected, onSelect, onDelete, deleting,
}: {
  link: ArchiveLink
  selected: boolean
  onSelect: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  return (
    // h-8 — matches the "+ Add a link" button's own w-8 h-8 square
    // directly above this list, rather than sizing to content (a
    // shorter row than that button made the two feel inconsistent).
    <div
      ref={setNodeRef}
      style={style}
      // bg-[#FFFFFF] is the mobile default (row sits directly over the
      // page background there otherwise, unlike desktop's own opaque
      // sidebar panel behind it) — reported directly. min-[1020px]:
      // reverts to the existing transparent/selected/hover-tinted
      // behavior, unchanged. bg-transparent has to live inside the
      // ternary's own else-branch, not applied unconditionally alongside
      // it — two min-[1020px]:bg-* utilities active on the same element
      // at once compete over the same CSS property, and Tailwind's own
      // generation order (not the order they're written in this string)
      // decides the winner, which silently made the selected row's own
      // #EFEFEF lose to the always-on transparent utility.
      className={`group flex h-8 items-center gap-2 rounded bg-[#FFFFFF] ${selected ? 'min-[1020px]:bg-[#EFEFEF] noir-selected-bg' : 'min-[1020px]:bg-transparent min-[1020px]:hover:bg-[#EFEFEF] noir-row-hover'}`}
    >
      {/* Grabber + title share their own tighter gap-1 (not the row's
          shared gap-2) — reported directly, so the handle sits closer to
          the text it's dragging than the row's other icon buttons sit
          from each other. */}
      <div className="flex flex-1 min-w-0 items-center gap-1">
        {/* Same GripVertical icon/drag mechanism as gallery-grid.tsx's own
            image-reorder handle, restyled to match this row's own
            open-in-new-tab button (rounded, text-ink-400 default,
            hover:bg-[#C9C9C8]) instead of that one's circular black-chip
            look — that styling belongs to a photo-thumbnail overlay, a
            different context from a plain list row. Always visible (not
            opacity-0 group-hover like the arrow/delete buttons) —
            reported directly, so the handle itself is discoverable
            without first having to hover the row to notice reordering
            is possible. */}
        <button
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${link.title}`}
          className="shrink-0 w-6 h-6 ml-1 rounded flex items-center justify-center text-ink-400 hover:text-ink hover:bg-[#C9C9C8] transition-all cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={13} />
        </button>
        {/* Desktop only — selects the link into the sidebar's own
            preview iframe. */}
        <button
          type="button"
          onClick={onSelect}
          className="hidden min-[1020px]:block flex-1 min-w-0 text-left px-1 py-1"
        >
          <p
            className={`text-sm truncate ${selected ? 'font-medium' : ''}`}
            style={{ color: selected ? 'var(--theme-accent)' : 'color-mix(in srgb, var(--theme-accent) 60%, transparent)' }}
          >{link.title}</p>
        </button>
        {/* Mobile only — there's no preview pane to select into there, so
            tapping the title opens the link directly instead, reported
            directly. */}
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-[1020px]:hidden flex-1 min-w-0 text-left px-1 py-1"
        >
          <p className="text-sm truncate" style={{ color: 'color-mix(in srgb, var(--theme-accent) 60%, transparent)' }}>{link.title}</p>
        </a>
      </div>
      {/* Desktop-only open/delete pair — hover-revealed, sharing their own
          tighter gap-1 (not the row's shared gap-2), reported directly.
          Hidden entirely on mobile: the open icon would be redundant
          there (tapping the title already opens the link, see above),
          and mobile gets its own always-visible delete button instead
          (below) rather than sharing this hover-gated one — touch has no
          hover state to reveal it with. */}
      <div className="hidden min-[1020px]:flex items-center gap-1">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${link.title} in a new tab`}
          className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-ink-400 opacity-0 group-hover:opacity-100 hover:text-ink hover:bg-[#C9C9C8] transition-all"
        >
          <ArrowUpRight size={13} />
        </a>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          aria-label={`Delete ${link.title}`}
          className="shrink-0 w-6 h-6 mr-1 rounded flex items-center justify-center text-ink-400 opacity-0 group-hover:opacity-100 hover:text-ember hover:bg-ember/10 transition-all disabled:opacity-50"
        >
          <X size={13} />
        </button>
      </div>
      {/* Mobile-only delete — always visible, not hover-gated, reported
          directly (no hover state on a touch device to reveal it with). */}
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label={`Delete ${link.title}`}
        className="min-[1020px]:hidden shrink-0 w-6 h-6 mr-1 rounded flex items-center justify-center text-ink-400 hover:text-ember hover:bg-ember/10 transition-all disabled:opacity-50"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// Mirrors post-modal.tsx's own sidebar + large-content-pane layout
// (fixed inset-0, bg-scroll-50 sidebar, min-[1020px]:pl clearing
// ArchiveSideNav's own left-[2.6%] the same way that file clears Nav's
// category rail) — reported directly, referencing that page's look for
// this one rather than inventing a new shape. Differs where the mockup
// called for it: no author/category metadata rows, the sidebar's own
// content is the link list itself (selectable + addable) instead of a
// single post's fields, the right pane previews the SELECTED link in an
// iframe instead of showing a fixed image, and there's no page-level
// Edit/Hold-to-delete pair at the bottom — deletion is a small per-item
// control in the list instead, since there's no single "post" being
// edited here. That whole fixed-overlay/preview-pane shape is desktop-
// only now (min-[1020px]:) — mobile gets its own plain in-flow page
// instead (ArchiveSectionTabs at the top, like archive/trpg/page.tsx),
// with no preview pane at all: reported directly, tapping a link there
// just opens it in a new tab (see SortableLinkRow's own comment).
export function LinksArchiveView({ links: initialLinks }: { links: ArchiveLink[] }) {
  const [links, setLinks] = useState(initialLinks)
  const [selectedId, setSelectedId] = useState<string | null>(initialLinks[0]?.id ?? null)
  // Closing the list just hides that pane and lets the preview take the
  // full width instead — reported directly, referencing a clean sidebar
  // reference's own show/hide toggle for the general idea (a small icon
  // button, not any of that reference's own specific styling/markup).
  // Desktop-only now — mobile's own list has no preview pane to collapse
  // for, so this state (and the whole rail/collapse concept) simply
  // doesn't apply there.
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // Tracks the CURRENTLY MOUNTED iframe, not the selected link — reset
  // whenever selectedId changes so switching links shows the loader again
  // instead of holding the previous link's "loaded" state over the new src.
  const [iframeLoading, setIframeLoading] = useState(true)
  // A private Google Doc/Sheet's /preview URL tries to sign the viewer in
  // INSIDE the iframe, but Google itself refuses to let accounts.google.com
  // be framed by anyone else — so that sign-in attempt can hang far longer
  // than a normal page load, sometimes never firing the iframe's own load
  // event at all. Nothing on this side can detect or fix that mid-hang, so
  // instead of leaving the spinner up forever, a slow load surfaces this
  // explanation and the same "open in new tab" escape hatch after a
  // generous delay (public embeds in testing took ~8-10s on their own).
  const [showSlowNotice, setShowSlowNotice] = useState(false)

  const selected = links.find(l => l.id === selectedId) ?? null
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    setIframeLoading(true)
    setShowSlowNotice(false)
    const timer = setTimeout(() => setShowSlowNotice(true), 12000)
    return () => clearTimeout(timer)
  }, [selectedId])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const result = await createLink(title, url)
    setSubmitting(false)
    if (result.error || !result.link) { setError(result.error ?? 'Could not add the link.'); return }
    setLinks(prev => [result.link, ...prev])
    setSelectedId(result.link.id)
    setTitle('')
    setUrl('')
    setAdding(false)
  }

  async function handleDelete(link: ArchiveLink) {
    setDeletingId(link.id)
    const result = await deleteLink(link.id)
    setDeletingId(null)
    if (result.error) { setError(result.error); return }
    setLinks(prev => {
      const next = prev.filter(l => l.id !== link.id)
      if (selectedId === link.id) setSelectedId(next[0]?.id ?? null)
      return next
    })
  }

  // Simpler than gallery-grid.tsx's own handleDragEnd — this is a plain
  // vertical list of uniform-height rows, not a variable-height masonry
  // grid, so the standard event.over (via closestCenter) is reliable
  // here and doesn't need that file's own collisions-array workaround.
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = links.findIndex(l => l.id === active.id)
    const newIndex = links.findIndex(l => l.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(links, oldIndex, newIndex)
    setLinks(reordered)
    await reorderLinks(reordered.map(l => l.id))
  }

  // Shared by the mobile page list and desktop's expanded panel — same
  // add form/button and the same DndContext-wrapped list, just placed in
  // two very differently-shaped parents (see the component's own top
  // comment). dndId has to differ per call: both render simultaneously
  // in the DOM (CSS hides whichever doesn't match the current
  // breakpoint, rather than unmounting it), so two DndContexts with the
  // same id would mean duplicate ids in the document at once.
  // forPreviewSelection controls whether a row shows as "selected" —
  // true only for the desktop instance, since "selected" means "showing
  // in the preview iframe," a concept mobile's own list doesn't have.
  function renderAddAndList(dndId: string, forPreviewSelection: boolean) {
    return (
      <>
        {adding ? (
          <form onSubmit={handleAdd} className="flex flex-col gap-2 pb-2 border-b border-scroll-300">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Title"
              autoFocus
              className="input"
            />
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://…"
              className="input"
            />
            {error && <p className="field-error text-xs">{error}</p>}
            <div className="flex gap-2">
              {/* justify-center — .btn-primary itself has no
                  justify-content (fine where it's only as wide as its
                  own content elsewhere), but flex-1 here stretches it
                  to fill the row, which left the text sitting at the
                  button's left edge instead of centered. */}
              <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
                {submitting ? 'Adding…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setError('') }}
                className="btn-ghost"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="Add a link"
            title="Add a link"
            className="self-start w-8 h-8 rounded flex items-center justify-center text-ink-400 hover:text-ink-600 hover:bg-[#EFEFEF] noir-row-hover transition-colors"
          >
            <Plus size={18} />
          </button>
        )}

        <div className="flex flex-col gap-2">
          {links.length === 0 && !adding && (
            <p className="text-ink-400 text-sm py-2">No links yet — add the first one.</p>
          )}
          {/* Explicit id — without one, dnd-kit auto-generates its a11y
              description id from a module-level counter, which can land
              on a different number for the server render vs. the
              client's first render and trip a hydration mismatch on
              aria-describedby (same reasoning as gallery-grid.tsx's
              own DndContext). */}
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={links.map(l => l.id)} strategy={verticalListSortingStrategy}>
              {links.map(link => (
                <SortableLinkRow
                  key={link.id}
                  link={link}
                  selected={forPreviewSelection && selectedId === link.id}
                  onSelect={() => setSelectedId(link.id)}
                  onDelete={() => handleDelete(link)}
                  deleting={deletingId === link.id}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Mobile (below 1020px) — a plain in-flow page, not the fixed
          overlay desktop gets below. Same breakout wrapper as
          archive/trpg/page.tsx (escapes the shared <main>'s centered
          max-w-5xl, no manual top padding of its own — inherits the
          shared archive layout's own pt-24, same as that page). */}
      <div className="min-[1020px]:hidden w-screen relative left-1/2 -translate-x-1/2 px-4">
        <div className="animate-fade-up flex flex-col gap-4">
          <ArchiveSectionTabs />
          {renderAddAndList('archive-links-list-mobile', false)}
        </div>
      </div>

      {/* Desktop (1020px+) — the fixed overlay + collapsible sidebar/rail
          + preview pane described in the component's own top comment. */}
      <div className="hidden min-[1020px]:flex fixed inset-0 z-50 pl-[calc(2.6vw+159px)] flex-row overflow-hidden animate-fade-up">
        {/* Always mounted (not conditionally rendered) so width/max-height can
            transition instead of popping in/out. On desktop, collapsing no
            longer hides the sidebar entirely — it narrows to a persistent
            56px icon rail (referencing the general shape of a collapsed chat
            sidebar: a reopen icon up top, compact icons below with a
            hover-revealed name tooltip, not any of that reference's specific
            icon set or markup) instead of disappearing, so there's always a
            way back in without hunting for a floating button.
            overflow is only hidden while expanded/expanding — the collapsed
            rail's own content is already exactly 56px wide, so nothing
            spills, and leaving it visible there is what lets the rail's
            hover tooltips extend out past the rail's edge. Both x and y
            must flip together per state, not just x: per the CSS overflow
            spec, an axis left at "visible" while the other axis is anything
            non-visible silently computes as "auto" instead — so a stray
            always-on overflow-y-auto here was clipping the tooltips even
            though overflow-x was "visible". */}
        <div
          className={`shrink-0 border-scroll-300 noir-border bg-scroll-50 noir-panel-bg transition-[width,opacity] duration-300 ease-in-out h-full border-l border-r ${
            sidebarOpen
              ? 'w-[250px] opacity-100 overflow-y-auto overflow-x-hidden'
              : 'w-14 opacity-100 overflow-visible'
          }`}
        >
          {sidebarOpen ? (
            <div className="w-[250px] px-3 py-6 flex flex-col gap-2">
              {/* gap-2 (not gap-4) — matched to the collapsed rail's own
                  header rhythm below (Show → gap-2 → Add → gap-2 → list) so
                  the list's own first item lands at the same y position in
                  both states instead of drifting a few px between them. w-8
                  h-8 here too (was w-7 h-7, with a now-removed -mt-1 that
                  compensated for it) — that leftover -mt-1 pulled this
                  button 4px above the padding box while the collapsed
                  rail's own Show button (no such margin) sat right at it,
                  which was the actual few-px drift being reported; -mr-1
                  stays since it's just tucking the icon horizontally into
                  this panel's own corner, unrelated to the collapsed
                  rail's differently-aligned (centered, not right-aligned)
                  header. */}
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Hide link list"
                className="self-end -mr-1 w-8 h-8 rounded flex items-center justify-center text-ink-400 hover:text-ink hover:bg-[#EFEFEF] noir-row-hover transition-colors"
              >
                <PanelLeftClose size={16} />
              </button>

              {/* Originally referenced the profile grid's own "add new" tile
                  (character-pair-grid.tsx's AddPairCard: text-ink-400 →
                  hover:text-ink-600, still bg-[#2F2F2E]/20 there today) for
                  this same quiet-icon-then-tinted-hover shape, though the
                  hover color itself has since diverged to #EFEFEF to match
                  this list's own selected/hover color elsewhere. Moved to
                  the top of the list (not the old bottom placement) so opening
                  the form doesn't feel disconnected from the button that
                  opened it. Wrapped together with the list below in their
                  own gap-2 (8px) column — unified with the list's own
                  item-to-item gap (also 8px, was 4px) so the "+"-to-first-
                  item spacing (was 16px, inherited from the outer column's
                  gap-4) now matches item-to-item spacing exactly. */}
              <div className="flex flex-col gap-2">
                {renderAddAndList('archive-links-list-desktop', true)}
              </div>
            </div>
          ) : (
            <div className="flex w-14 h-full flex-col items-center gap-2 py-6">
              {/* gap-2 (not gap-3) — matches the expanded panel's own header
                  rhythm (see that branch's own comment), so the list's
                  first item lands at the same y position in both states.
                  Tooltip is .thought-tt-side (globals.css), the same
                  scale+fade transition/style as the "SETTINGS" desk-icon
                  tooltip on the landing page (desk-app-icon.tsx's own
                  .thought-tt), just repositioned to the side instead of
                  above — see that CSS rule's own comment for why it's a
                  separate class rather than a modifier on .thought-tt. */}
              <div className="thought-tt-wrap">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Show link list"
                  className="thought-tt-trigger w-8 h-8 rounded flex items-center justify-center text-ink-400 hover:text-ink hover:bg-[#EFEFEF] transition-colors"
                >
                  <PanelLeftOpen size={16} />
                </button>
                <span aria-hidden="true" className="thought-tt-side">Show link list</span>
              </div>

              <div className="thought-tt-wrap">
                <button
                  type="button"
                  onClick={() => { setSidebarOpen(true); setAdding(true) }}
                  aria-label="Add a link"
                  className="thought-tt-trigger w-8 h-8 rounded flex items-center justify-center text-ink-400 hover:text-ink-600 hover:bg-[#EFEFEF] noir-row-hover transition-colors"
                >
                  <Plus size={16} />
                </button>
                <span aria-hidden="true" className="thought-tt-side">Add a link</span>
              </div>

              {/* Each link collapses to its initial in a small circle — there's
                  no per-link icon/favicon to fall back to instead — with the
                  full title as a hover tooltip, mirroring how the expanded
                  list's own title text works but compressed to fit the rail.
                  Deliberately NOT overflow-y-auto: that non-visible Y axis
                  would force this div's own X axis to compute as auto too
                  (the same spec quirk documented on the outer wrapper above),
                  clipping every link's tooltip even though the outer wrapper
                  is visible — exactly what broke here before. A very long
                  link list will just extend past the rail without its own
                  scrollbar until the outer root's own overflow-hidden clips
                  it; revisit if that turns out to matter in practice. */}
              <div className="flex w-full flex-col items-center gap-2">
                {links.map(link => (
                  <div key={link.id} className="thought-tt-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedId(link.id)}
                      aria-label={link.title}
                      className={`thought-tt-trigger w-8 h-8 shrink-0 rounded flex items-center justify-center text-sm font-medium transition-colors ${
                        selectedId === link.id ? 'bg-[#EFEFEF]' : 'hover:bg-[#EFEFEF]'
                      }`}
                      style={{ color: selectedId === link.id ? 'var(--theme-accent)' : 'color-mix(in srgb, var(--theme-accent) 60%, transparent)' }}
                    >
                      {(link.title.trim().charAt(0) || '?').toUpperCase()}
                    </button>
                    <span aria-hidden="true" className="thought-tt-side">{link.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected-link preview — an iframe, not a fixed image the way
            post-modal.tsx shows one: what's being previewed here is
            whichever link the sidebar has selected, which is arbitrary
            external content rather than something this app hosts itself.
            Google Docs/Sheets/Slides/Forms links get rewritten to their
            embeddable URL (see getEmbedUrl above); anything else that still
            refuses to be framed (X-Frame-Options/CSP) just renders blank —
            the "Open in new tab" button is the fallback for that case,
            always visible rather than only appearing after a failed load,
            since a blocked frame can't be detected from this side. */}
        <div className="relative flex-1 min-h-0 bg-scroll-200 flex items-center justify-center">
          {selected && (
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-ink-400 bg-scroll-100 hover:text-ink hover:bg-scroll-50 shadow-sm transition-colors"
            >
              Open in new tab
              <ExternalLink size={13} />
            </a>
          )}
          {selected ? (
            <>
              {/* Sits over the iframe rather than replacing it, so the frame
                  is already mounted and loading underneath by the time the
                  loader fades out — no extra round trip after onLoad fires. */}
              {iframeLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#F1F1F1] px-8 text-center">
                  <DotMatrixLoader size={28} busyCursor={false} />
                  {showSlowNotice && (
                    <p className="max-w-[240px] text-xs text-ink-400">
                      로딩이 오래 걸리고 있어요 — 비공개 Google 문서나 시트는 로그인 시도 중 멈출 수 있습니다. 대신{' '}
                      <a href={selected.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                        새 탭에서 열어보세요
                      </a>
                      .
                    </p>
                  )}
                </div>
              )}
              <iframe
                key={selected.id}
                src={getEmbedUrl(selected.url)}
                title={selected.title}
                onLoad={() => setIframeLoading(false)}
                className="w-full h-full border-0"
              />
            </>
          ) : (
            <p className="text-ink-400 text-sm px-6 text-center">
              {links.length === 0 ? 'Add a link to preview it here.' : 'Select a link to preview it here.'}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
