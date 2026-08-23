'use client'
import { X } from 'lucide-react'
import { usePersistentDraggable } from '@/lib/use-persistent-draggable'
import type { DockApp } from '@/lib/dock-apps'

// A single app's floating window — position is dragged from its header only
// (not the body, standard desktop-window UX) and persisted per-browser via
// usePersistentDraggable, so closing and reopening the same app restores
// where it was left. Content is a placeholder until each app gets real
// functionality; the dock/window shell itself doesn't change when that
// happens.
export function DockAppWindow({ app, cascade, zIndex, onFocus, onClose, children }: {
  app: DockApp
  cascade: number
  zIndex: number
  onFocus: () => void
  onClose: () => void
  children?: React.ReactNode
}) {
  const drag = usePersistentDraggable(`dock-window:${app.id}`, { x: cascade * 24, y: cascade * 24 })
  const Icon = app.icon

  return (
    <div
      onPointerDown={onFocus}
      className="fixed left-1/2 top-1/2 w-[280px] rounded-xl border border-scroll-300 bg-scroll-50 shadow-parchment overflow-hidden"
      style={{ transform: `translate(-50%, -50%) translate(${drag.offset.x}px, ${drag.offset.y}px)`, zIndex }}
    >
      <div
        {...drag.handlers}
        className={`flex items-center justify-between gap-2 px-3 py-2 border-b border-scroll-300 touch-none ${drag.dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ background: '#282625' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {Icon && <Icon size={13} className="text-scroll-100 shrink-0" />}
          <span className="font-mono text-[10px] uppercase tracking-wide text-scroll-100 truncate">{app.label}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          onPointerDown={e => e.stopPropagation()}
          aria-label={`Close ${app.label}`}
          className="shrink-0 text-scroll-100/70 hover:text-scroll-100"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-4 min-h-[120px] flex items-center justify-center">
        {children ?? <p className="font-mono text-[11px] text-ink-400">Coming soon.</p>}
      </div>
    </div>
  )
}
