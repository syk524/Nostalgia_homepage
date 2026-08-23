'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { ExternalLink, PanelLeftClose, PanelLeftOpen, Plus, X } from 'lucide-react'
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
    setLinks(prev => [...prev, result.link])
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
          transition instead of popping in/out — the inner panel keeps a
          fixed size and the wrapper just clips it as it collapses. */}
      <div
        className={`shrink-0 overflow-hidden border-scroll-300 bg-scroll-50 transition-[width,max-height,opacity] duration-300 ease-in-out min-[1020px]:h-full min-[1020px]:overflow-y-auto border-b min-[1020px]:border-b-0 min-[1020px]:border-r ${
          sidebarOpen
            ? 'w-full min-[1020px]:w-96 max-h-[80vh] min-[1020px]:max-h-full opacity-100'
            : 'w-full min-[1020px]:w-0 max-h-0 min-[1020px]:max-h-full opacity-0'
        }`}
      >
        <div className="w-full min-[1020px]:w-96 p-6 flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Hide link list"
            className="self-end -mr-1 -mt-1 w-7 h-7 rounded-full flex items-center justify-center text-ink-400 hover:text-ink hover:bg-scroll-200 transition-colors"
          >
            <PanelLeftClose size={15} />
          </button>

          <div className="flex flex-col gap-1">
            {links.length === 0 && !adding && (
              <p className="text-ink-400 text-sm py-2">No links yet — add the first one.</p>
            )}
            {links.map(link => (
              <div
                key={link.id}
                className={`group flex items-center gap-2 rounded ${selectedId === link.id ? 'bg-scroll-200' : 'hover:bg-scroll-200/60'}`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(link.id)}
                  className="flex-1 min-w-0 text-left px-2 py-2"
                >
                  <p className={`text-sm truncate ${selectedId === link.id ? 'text-ink font-medium' : 'text-ink-400'}`}>{link.title}</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(link)}
                  disabled={deletingId === link.id}
                  aria-label={`Delete ${link.title}`}
                  className="shrink-0 w-6 h-6 mr-1 rounded-full flex items-center justify-center text-ink-400 opacity-0 group-hover:opacity-100 hover:text-ember hover:bg-ember/10 transition-all disabled:opacity-50"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          {adding ? (
            <form onSubmit={handleAdd} className="flex flex-col gap-2 pt-4 mt-2 border-t border-scroll-300">
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
              className="flex items-center gap-2 text-sm text-ink-400 hover:text-ink pt-4 mt-2 border-t border-scroll-300 transition-colors"
            >
              <Plus size={14} />
              Add a link
            </button>
          )}
        </div>
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
        {/* Always mounted so it fades in/out in step with the sidebar's own
            collapse instead of popping in the instant the list finishes
            hiding; pointer-events-none keeps it from intercepting clicks
            while the sidebar is open and it's invisible. */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Show link list"
          className={`absolute top-4 left-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-ink-400 bg-scroll-100 hover:text-ink hover:bg-scroll-50 shadow-sm transition-opacity duration-300 ease-in-out ${
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
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-scroll-200 px-8 text-center">
                <DotMatrixLoader size={28} busyCursor={false} />
                {showSlowNotice && (
                  <p className="max-w-[240px] text-xs text-ink-400">
                    Taking a while — a private Google Doc or Sheet can hang here while it tries to sign you in.{' '}
                    <a href={selected.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                      Open it in a new tab
                    </a>{' '}
                    instead.
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
