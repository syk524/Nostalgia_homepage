'use client'
import { useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { createLink, deleteLink } from '@/lib/actions/archive-links'
import type { ArchiveLink } from '@/types/database'

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
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const selected = links.find(l => l.id === selectedId) ?? null

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
      <div className="w-full min-[1020px]:w-96 shrink-0 min-[1020px]:h-full min-[1020px]:overflow-y-auto border-b min-[1020px]:border-b-0 min-[1020px]:border-r border-scroll-300 bg-scroll-50 p-6 flex flex-col gap-4">
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
                <p className="text-xs text-ink-400 truncate">{link.url}</p>
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

      {/* Selected-link preview — an iframe, not a fixed image the way
          post-modal.tsx shows one: what's being previewed here is
          whichever link the sidebar has selected, which is arbitrary
          external content rather than something this app hosts itself.
          Some sites refuse to be framed (X-Frame-Options/CSP) and will
          just render blank inside the iframe — an inherent limitation of
          previewing arbitrary third-party URLs this way, not something
          fixable from this side. */}
      <div className="relative flex-1 min-h-0 bg-scroll-200 flex items-center justify-center">
        {selected ? (
          <iframe
            key={selected.id}
            src={selected.url}
            title={selected.title}
            className="w-full h-full min-h-[50vh] min-[1020px]:min-h-0 border-0"
          />
        ) : (
          <p className="text-ink-400 text-sm px-6 text-center">
            {links.length === 0 ? 'Add a link to preview it here.' : 'Select a link to preview it here.'}
          </p>
        )}
      </div>
    </div>
  )
}
