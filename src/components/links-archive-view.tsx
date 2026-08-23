'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowUpRight, ExternalLink, PanelLeftClose, PanelLeftOpen, Plus, X } from 'lucide-react'
import { createLink, deleteLink } from '@/lib/actions/archive-links'
import { DotMatrixLoader } from '@/components/dot-matrix-loader'
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
// edited here.
export function LinksArchiveView({ links: initialLinks }: { links: ArchiveLink[] }) {
  const [links, setLinks] = useState(initialLinks)
  const [selectedId, setSelectedId] = useState<string | null>(initialLinks[0]?.id ?? null)
  // Closing the list just hides that pane and lets the preview take the
  // full width instead — reported directly, referencing a clean sidebar
  // reference's own show/hide toggle for the general idea (a small icon
  // button, not any of that reference's own specific styling/markup).
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

  return (
    <div className="fixed inset-0 z-50 bg-scroll-100 min-[1020px]:pl-[calc(2.6vw+159px)] flex flex-col min-[1020px]:flex-row overflow-y-auto min-[1020px]:overflow-hidden animate-fade-up">
      {/* Always mounted (not conditionally rendered) so width/max-height can
          transition instead of popping in/out. On desktop, collapsing no
          longer hides the sidebar entirely — it narrows to a persistent
          56px icon rail (referencing the general shape of a collapsed chat
          sidebar: a reopen icon up top, compact icons below with a
          hover-revealed name tooltip, not any of that reference's specific
          icon set or markup) instead of disappearing, so there's always a
          way back in without hunting for a floating button. Mobile keeps
          the old full-collapse behavior (a side RAIL doesn't make sense
          for a pane that's stacked above the preview, not beside it), via
          the floating "Show link list" button in the preview pane below.
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
        className={`shrink-0 border-scroll-300 bg-scroll-50 transition-[width,max-height,opacity] duration-300 ease-in-out min-[1020px]:h-full border-b min-[1020px]:border-b-0 min-[1020px]:border-r ${
          sidebarOpen
            ? 'w-full min-[1020px]:w-[250px] max-h-[80vh] min-[1020px]:max-h-full opacity-100 overflow-hidden min-[1020px]:overflow-y-auto'
            : 'w-full min-[1020px]:w-14 max-h-0 min-[1020px]:max-h-full opacity-0 min-[1020px]:opacity-100 overflow-visible'
        }`}
      >
        {sidebarOpen ? (
          <div className="w-full min-[1020px]:w-[250px] p-6 flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Hide link list"
              className="self-end -mr-1 -mt-1 w-7 h-7 rounded-full flex items-center justify-center text-ink-400 hover:text-ink hover:bg-scroll-200 transition-colors"
            >
              <PanelLeftClose size={15} />
            </button>

            {/* Same quiet-icon-then-tinted-hover treatment as the profile
                grid's own "add new" tile (character-pair-grid.tsx's
                AddPairCard: text-ink-400 → hover:text-ink-600 with a
                hover:bg-[#2F2F2E]/20 tint) — referenced rather than reused
                directly since that one is a full grid tile sized to match a
                pair card, which doesn't fit a compact sidebar list. Moved to
                the top of the list (not the old bottom placement) so opening
                the form doesn't feel disconnected from the button that
                opened it. */}
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
                  <button type="submit" disabled={submitting} className="btn-primary flex-1">
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
                className="self-start w-8 h-8 rounded flex items-center justify-center text-ink-400 hover:text-ink-600 hover:bg-[#EFEFEF] transition-colors"
              >
                <Plus size={18} />
              </button>
            )}

            <div className="flex flex-col gap-1">
              {links.length === 0 && !adding && (
                <p className="text-ink-400 text-sm py-2">No links yet — add the first one.</p>
              )}
              {links.map(link => (
                <div
                  key={link.id}
                  className={`group flex items-center gap-2 rounded ${selectedId === link.id ? 'bg-[#EFEFEF]' : 'hover:bg-[#EFEFEF]'}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(link.id)}
                    className="flex-1 min-w-0 text-left px-2 py-2"
                  >
                    <p className={`text-sm truncate ${selectedId === link.id ? 'text-ink font-medium' : 'text-ink-400'}`}>{link.title}</p>
                  </button>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${link.title} in a new tab`}
                    className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-ink-400 opacity-0 group-hover:opacity-100 hover:text-ink hover:bg-scroll-300 transition-all"
                  >
                    <ArrowUpRight size={13} />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(link)}
                    disabled={deletingId === link.id}
                    aria-label={`Delete ${link.title}`}
                    className="shrink-0 w-6 h-6 mr-1 rounded flex items-center justify-center text-ink-400 opacity-0 group-hover:opacity-100 hover:text-ember hover:bg-ember/10 transition-all disabled:opacity-50"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="hidden min-[1020px]:flex w-14 h-full flex-col items-center gap-3 py-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Show link list"
              className="group relative w-8 h-8 rounded flex items-center justify-center text-ink-400 hover:text-ink hover:bg-scroll-200 transition-colors"
            >
              <PanelLeftOpen size={16} />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-ink-900 px-2 py-1 text-xs text-scroll-100 opacity-0 transition-opacity group-hover:opacity-100"
              >
                Show link list
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setSidebarOpen(true); setAdding(true) }}
              aria-label="Add a link"
              className="group relative w-8 h-8 rounded flex items-center justify-center text-ink-400 hover:text-ink-600 hover:bg-[#2F2F2E]/20 transition-colors"
            >
              <Plus size={16} />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-ink-900 px-2 py-1 text-xs text-scroll-100 opacity-0 transition-opacity group-hover:opacity-100"
              >
                Add a link
              </span>
            </button>

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
                <button
                  key={link.id}
                  type="button"
                  onClick={() => setSelectedId(link.id)}
                  aria-label={link.title}
                  className={`group relative w-8 h-8 shrink-0 rounded flex items-center justify-center text-xs font-medium transition-colors ${
                    selectedId === link.id ? 'bg-[#EFEFEF] text-ink' : 'text-ink-400 hover:bg-scroll-200/60'
                  }`}
                >
                  {(link.title.trim().charAt(0) || '?').toUpperCase()}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-ink-900 px-2 py-1 text-xs text-scroll-100 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    {link.title}
                  </span>
                </button>
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
        {/* Mobile-only fallback: the sidebar collapses to a full-width
            0-height pane there instead of a persistent rail (see the
            wrapper's own comment above), so this is the only way back in
            on that layout. Desktop's reopen icon lives inside the rail
            itself instead. Always mounted so it fades in/out in step with
            the sidebar's own collapse instead of popping in the instant
            the list finishes hiding; pointer-events-none keeps it from
            intercepting clicks while the sidebar is open and it's
            invisible. */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Show link list"
          className={`absolute top-4 left-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-ink-400 bg-scroll-100 hover:text-ink hover:bg-scroll-50 shadow-sm transition-opacity duration-300 ease-in-out min-[1020px]:hidden ${
            sidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <PanelLeftOpen size={16} />
        </button>
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
              className="w-full h-full min-h-[50vh] min-[1020px]:min-h-0 border-0"
            />
          </>
        ) : (
          <p className="text-ink-400 text-sm px-6 text-center">
            {links.length === 0 ? 'Add a link to preview it here.' : 'Select a link to preview it here.'}
          </p>
        )}
      </div>
    </div>
  )
}
