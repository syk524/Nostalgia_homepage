'use client'
import { useRef, useState } from 'react'
import { ChevronUp, ChevronDown, X, Plus, Star } from 'lucide-react'
import { ImageFocalEditor } from '@/components/image-focal-editor'

export type NovelPageItem = { imagePreview: string | null; body: string; imageCredit: string; isThumbnail: boolean; focalX: number; focalY: number }

// The novel-post equivalent of image-manager.tsx's thumbnail grid — but a
// page needs a lot more editing surface than a 96×96 tile (a full
// paragraph textarea alongside its own optional image), so this is a
// tall vertical list of cards instead of a grid, with plain up/down
// buttons for reordering rather than image-manager.tsx's native
// drag-and-drop (a full second dnd implementation isn't worth it for
// what's typically a handful of pages, not dozens of images).
export function NovelPageEditor({
  pages, onBodyChange, onImageSelect, onImageRemove, onCreditChange, onSetThumbnail, onFocalChange, onAdd, onRemove, onMove,
}: {
  pages: NovelPageItem[]
  onBodyChange: (index: number, body: string) => void
  onImageSelect: (index: number, file: File) => void
  onImageRemove: (index: number) => void
  onCreditChange: (index: number, credit: string) => void
  onSetThumbnail: (index: number) => void
  onFocalChange: (index: number, x: number, y: number) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onMove: (index: number, direction: -1 | 1) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  // Single shared hidden input, not one ref per page — which page it
  // applies to is tracked here instead, set right before the input is
  // clicked.
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  // Which page's image is open in the crop-framing editor below — same
  // per-index-not-per-item tracking as activeIndex above, and same
  // ImageFocalEditor image-manager.tsx already uses for gallery images,
  // since a novel page's thumbnail image wants the exact same 16:9
  // framing control once it can be used as the grid thumbnail.
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  function openFilePicker(index: number) {
    setActiveIndex(index)
    fileRef.current?.click()
  }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || activeIndex === null) return
    onImageSelect(activeIndex, file)
  }

  const editing = editingIndex !== null ? pages[editingIndex] : null

  return (
    <>
    <div className="space-y-3">
      {pages.map((page, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-400 font-mono uppercase tracking-wide">Page {i + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0} className="btn-ghost p-1 disabled:opacity-30" aria-label="Move page up">
                <ChevronUp size={14} />
              </button>
              <button type="button" onClick={() => onMove(i, 1)} disabled={i === pages.length - 1} className="btn-ghost p-1 disabled:opacity-30" aria-label="Move page down">
                <ChevronDown size={14} />
              </button>
              <button type="button" onClick={() => onRemove(i)} className="btn-ghost p-1 text-ember" aria-label="Remove page">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-24 aspect-video rounded border-2 border-dashed border-scroll-300 overflow-hidden shrink-0 group">
              {page.imagePreview ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditingIndex(i)}
                    aria-label="Set thumbnail framing"
                    className="block w-full h-full"
                  >
                    <img
                      src={page.imagePreview}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ objectPosition: `${page.focalX}% ${page.focalY}%` }}
                    />
                  </button>
                  {/* If this novel post has more than one page with an
                      image, the gallery grid needs to know which one to
                      use — this star, same pattern as
                      character-pair-form.tsx's own primary-profile toggle,
                      marks that page (see gallery-grid.tsx's own thumb
                      resolution: is_thumbnail wins, first image is only
                      the fallback for posts that never touched this). */}
                  <button
                    type="button"
                    onClick={() => onSetThumbnail(i)}
                    aria-label={page.isThumbnail ? 'Gallery thumbnail' : 'Set as gallery thumbnail'}
                    className={`absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/70 text-white flex items-center justify-center transition-opacity ${
                      page.isThumbnail ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Star size={11} className={page.isThumbnail ? 'fill-current' : ''} />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-scroll-100">
                  <span className="text-xl text-scroll-400">◯</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 items-start">
              <button type="button" onClick={() => openFilePicker(i)} className="btn-ghost text-xs">
                {page.imagePreview ? 'Change Image' : 'Add Image (optional)'}
              </button>
              {page.imagePreview && (
                <button type="button" onClick={() => onImageRemove(i)} className="text-xs text-ink-400 hover:text-ember">
                  Remove Image
                </button>
              )}
              {page.imagePreview && (
                <input
                  type="text"
                  className="input text-xs w-48"
                  value={page.imageCredit}
                  onChange={e => onCreditChange(i, e.target.value)}
                  placeholder="Credit (optional)"
                />
              )}
            </div>
          </div>

          <textarea
            className="textarea w-full"
            rows={5}
            value={page.body}
            onChange={e => onBodyChange(i, e.target.value)}
            placeholder="Page text…"
          />
        </div>
      ))}

      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />

      <button type="button" onClick={onAdd} className="btn-ghost text-xs flex items-center gap-1.5">
        <Plus size={14} /> Add Page
      </button>
    </div>

    {editing?.imagePreview && editingIndex !== null && (
      <ImageFocalEditor
        src={editing.imagePreview}
        initialX={editing.focalX}
        initialY={editing.focalY}
        onSave={(x, y) => { onFocalChange(editingIndex, x, y); setEditingIndex(null) }}
        onClose={() => setEditingIndex(null)}
      />
    )}
    </>
  )
}
