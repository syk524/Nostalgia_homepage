'use client'
import { useRef, useState } from 'react'
import { X, Plus, Loader2, Images } from 'lucide-react'
import { usePersistentDraggable } from '@/lib/use-persistent-draggable'
import { uploadImage } from '@/lib/upload'
import { addGalleryImage, deleteGalleryImage } from '@/lib/actions/stickers'
import type { StickerGalleryImage } from '@/types/database'

// The shared sticker library (editor/admin only — see draggable-home-scene.tsx,
// which only ever mounts this for canEdit users). No dimmed backdrop and
// no backdrop-click close — it floats over the page exactly like a dock
// app window (see dock-app-window.tsx, whose header/no-shadow treatment
// this mirrors), draggable by its header and remembered per browser via
// usePersistentDraggable. The X is still the only way to close it. With
// no backdrop covering the canvas, drag-and-drop of a tile onto the
// background is handled directly by draggable-home-scene's own listeners
// again — nothing here needs to forward it anymore.
export function StickerGalleryModal({ images, ownerId, onClose, onImagesChange }: {
  images: StickerGalleryImage[]
  ownerId: string
  onClose: () => void
  onImagesChange: (images: StickerGalleryImage[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const drag = usePersistentDraggable('sticker-gallery-modal')

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError('')
    setUploading(true)
    const { url, path, error: uploadErr } = await uploadImage(file, ownerId, 'sticker-images')
    if (!url || !path) { setError(uploadErr ?? 'Upload failed.'); setUploading(false); return }

    const { image, error: saveErr } = await addGalleryImage(url, path)
    setUploading(false)
    if (!image) { setError(saveErr ?? 'Could not add the image.'); return }
    onImagesChange([image, ...images])
  }

  async function handleDelete(img: StickerGalleryImage) {
    setDeletingId(img.id)
    const { error: err } = await deleteGalleryImage(img.id, img.storage_path)
    setDeletingId(null)
    if (err) { setError(err); return }
    onImagesChange(images.filter(i => i.id !== img.id))
  }

  return (
    <div
      className="fixed left-1/2 top-1/2 z-[100] w-full max-w-lg max-h-[80vh] rounded-xl border border-scroll-300 bg-scroll-50 flex flex-col overflow-hidden"
      style={{ transform: `translate(-50%, -50%) translate(${drag.offset.x}px, ${drag.offset.y}px)` }}
    >
      <div
        {...drag.handlers}
        className={`flex items-center justify-between gap-2 px-4 py-2.5 touch-none ${drag.dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ background: '#282625' }}
      >
        <div className="flex items-center gap-1.5">
          <Images size={13} className="text-scroll-100" />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-scroll-100">Sticker Gallery</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          onPointerDown={e => e.stopPropagation()}
          aria-label="Close"
          className="text-scroll-100/70 hover:text-scroll-100"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-5 py-2 text-[11px] font-mono text-ink-400 border-b border-scroll-300">
        Drag a sticker onto the background to place it.
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {error && <p className="field-error text-xs mb-3">{error}</p>}

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-lg border border-dashed border-scroll-300 flex items-center justify-center text-ink-400 hover:text-ink-600 hover:border-ink-400 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

          {images.map(img => (
            <div key={img.id} className="group relative aspect-square rounded-lg border border-scroll-300 bg-scroll-100 overflow-hidden">
              <img
                src={img.image_url}
                alt=""
                draggable
                onDragStart={e => e.dataTransfer.setData('text/sticker-gallery-id', img.id)}
                className="w-full h-full object-contain p-2 cursor-grab active:cursor-grabbing select-none"
              />
              <button
                type="button"
                onClick={() => handleDelete(img)}
                disabled={deletingId === img.id}
                aria-label="Delete from gallery"
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink-900/60 text-scroll-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
              >
                {deletingId === img.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
              </button>
            </div>
          ))}
        </div>

        {images.length === 0 && (
          <p className="mt-4 text-[11px] font-mono text-ink-400">No stickers yet — add one above.</p>
        )}
      </div>
    </div>
  )
}
