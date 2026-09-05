'use client'
import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { createMemo } from '@/lib/actions/memo'
import { uploadImage } from '@/lib/upload'
import type { Memo } from '@/types/database'

// Always-present first tile in the grid (memo-board.tsx) — an editable
// draft memo rather than a separate "+" button/modal, per direct
// request: it shows the same square/image-then-text shape a real
// MemoCard has, so it previews as the memo it's about to become instead
// of opening a disconnected form. Committing is an explicit Save text
// CTA (bottom-right, no pill/background) that only appears once there's
// something to save — replacing an earlier click-anywhere-outside
// commit, per direct request: that gesture had no visible affordance and
// fired on any stray click, including ones the user didn't mean as
// "done here."
export function NewMemoTile({ userId, onCreated }: { userId: string; onCreated: (memo: Memo) => void }) {
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Local object URL, not the eventual uploaded one — this preview has to
  // exist before anything is uploaded (upload only happens on commit), so
  // there's nothing else to show it from. Revoked wherever it's replaced
  // or the tile resets, since createObjectURL leaks otherwise.
  function pickFile(f: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  function reset() {
    setContent('')
    pickFile(null)
    setError('')
  }

  async function commit() {
    if (saving) return
    if (!content.trim() && !file) return
    setSaving(true)
    setError('')

    let imageUrl: string | null = null
    let storagePath: string | null = null
    if (file) {
      const result = await uploadImage(file, userId, 'memo-images')
      if (result.error) { setError(result.error); setSaving(false); return }
      imageUrl = result.url
      storagePath = result.path
    }

    const { memo, error: createError } = await createMemo({ content, imageUrl, storagePath })
    setSaving(false)
    if (createError || !memo) { setError(createError ?? 'Could not add the memo.'); return }

    onCreated(memo)
    reset()
  }

  const hasImage = !!previewUrl
  const hasContent = !!(content.trim() || file)

  return (
    <div className="relative aspect-square">
      <div className="card noir-panel-bg noir-border overflow-hidden h-full flex flex-col select-none">
        {/* Same h-5 height as MemoCard's own grip-handle strip — this tile
            has nothing to drag, but a real memo's first line of text sits
            below that strip, and this pad's first line (the "New Memo"
            placeholder) needs to land at that same height or the two
            visibly mismatch next to each other in the grid, reported
            directly. Empty once an image is attached — the small preview
            badge below takes over as the only image control at that
            point (remove via its own X, no in-place "change" here). */}
        <div className="flex items-center justify-end h-5 shrink-0 px-1.5">
          {!hasImage && (
            <>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={e => pickFile(e.target.files?.[0] ?? null)} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach image"
                className="text-ink-400/50 hover:text-ink-400 noir-accent-color transition-colors"
              >
                <ImagePlus size={14} />
              </button>
            </>
          )}
        </div>

        <div className="flex-1 min-h-0 p-3">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="New Memo"
            className="w-full h-full resize-none bg-transparent border-0 focus:outline-none text-sm text-ink noir-accent-color noir-placeholder-accent placeholder:text-ink/30"
          />
        </div>
      </div>

      {hasImage && (
        // A small preview badge floating over the pad's own content
        // (bottom-left, its own stacking context above the card below
        // it), not a full-width image area pushing text down the way a
        // real MemoCard's does — reported directly: this is a draft
        // attachment, not yet the memo's own finished layout, so it
        // reads as "something you're about to attach" rather than a
        // preview of the final card.
        <div className="absolute bottom-2 left-2 w-16 h-16 rounded overflow-hidden shadow-parchment border border-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element -- a
              local blob: URL, not a remote asset next/image can optimize */}
          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => pickFile(null)}
            aria-label="Remove image"
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink-900 text-scroll-100 flex items-center justify-center shadow-parchment"
          >
            <X size={10} />
          </button>
        </div>
      )}

      {hasContent && (
        <button
          type="button"
          onClick={commit}
          disabled={saving}
          className="absolute bottom-2 right-2.5 text-xs font-medium text-ink-400 hover:text-ink-600 noir-accent-color transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      )}

      {error && (
        <p className="absolute inset-x-0 -bottom-5 text-xs text-ember truncate">{error}</p>
      )}
    </div>
  )
}
