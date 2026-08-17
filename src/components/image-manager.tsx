'use client'
import { useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { ImageFocalEditor } from '@/components/image-focal-editor'

type ManagedImage = { src: string; focalX: number; focalY: number }

// Shared by the New Post and Edit Post forms. Index 0 is always "the"
// thumbnail (matches how the gallery grid picks its thumb — sorted by
// position, first wins), so "set as thumbnail" just reorders to the front.
export function ImageManager({
  images, onSetThumbnail, onRemove, onFocalChange, onReorder, onAddClick,
}: {
  images: ManagedImage[]
  onSetThumbnail: (index: number) => void
  onRemove: (index: number) => void
  onFocalChange: (index: number, x: number, y: number) => void
  onReorder: (from: number, to: number) => void
  onAddClick: () => void
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const editing = editingIndex !== null ? images[editingIndex] : null

  function clearDrag() {
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragEnd={clearDrag}
            onDragOver={e => { e.preventDefault(); if (dragIndex !== null && overIndex !== i) setOverIndex(i) }}
            onDrop={e => { e.preventDefault(); if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i); clearDrag() }}
            className={`relative w-24 h-24 rounded overflow-hidden border group cursor-grab active:cursor-grabbing transition-opacity ${
              dragIndex === i ? 'opacity-40' : ''
            } ${overIndex === i && dragIndex !== null && dragIndex !== i ? 'border-ink ring-2 ring-ink' : 'border-scroll-300'}`}
          >
            <button
              type="button"
              onClick={() => setEditingIndex(i)}
              aria-label="Set thumbnail framing"
              className="block w-full h-full"
            >
              <img
                src={img.src}
                alt=""
                className="w-full h-full object-cover"
                style={{ objectPosition: `${img.focalX}% ${img.focalY}%` }}
              />
            </button>

            {i === 0 && (
              <span className="absolute bottom-1 left-1 text-[9px] font-mono uppercase tracking-wide text-white bg-ink/70 rounded px-1.5 py-0.5 pointer-events-none">
                Thumbnail
              </span>
            )}

            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => onSetThumbnail(i)}
                  aria-label="Set as thumbnail"
                  className="w-5 h-5 rounded-full bg-ink/70 text-white flex items-center justify-center hover:bg-ink"
                >
                  <ImageIcon size={11} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label="Remove image"
                className="w-5 h-5 rounded-full bg-ink/70 text-white text-xs flex items-center justify-center hover:bg-ink"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddClick}
          className="w-24 h-24 rounded border-2 border-dashed border-scroll-300 flex items-center justify-center text-scroll-400 text-2xl hover:border-scroll-400 transition-colors"
        >
          +
        </button>
      </div>

      {editing && editingIndex !== null && (
        <ImageFocalEditor
          src={editing.src}
          initialX={editing.focalX}
          initialY={editing.focalY}
          onSave={(x, y) => { onFocalChange(editingIndex, x, y); setEditingIndex(null) }}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </>
  )
}
