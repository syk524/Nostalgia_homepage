'use client'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, X } from 'lucide-react'
import type { QueueTrack } from '@/lib/playlist'

// One row, draggable by its own handle rather than the whole row —
// the row itself is onClick-driven (selects the track), same reasoning
// as gallery-grid.tsx's separate drag-handle button over making whole
// cards draggable. The currently-playing track never gets a handle at
// all (useSortable's own `disabled` option, not just a hidden button —
// it fully excludes the row from being a drag source) so it can't be
// picked up and moved; a fixed-width empty span holds its place so the
// row doesn't visually shift depending on which track happens to be
// current.
function SortableTrackRow({ track, isCurrent, canEdit, onSelect, onRemove }: {
  track: QueueTrack
  isCurrent: boolean
  canEdit: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
    disabled: isCurrent,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
        isCurrent ? 'bg-scroll-100/10 text-scroll-100' : 'text-scroll-300 hover:bg-scroll-100/5'
      }`}
      onClick={onSelect}
    >
      <span className="w-[13px] shrink-0 flex items-center justify-center">
        {canEdit && !isCurrent && (
          <button
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
            aria-label="Drag to reorder"
            className="text-scroll-500 hover:text-scroll-300 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical size={13} />
          </button>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{track.title}</div>
        <div className="truncate text-xs text-scroll-400">{track.artist}</div>
      </div>
      {canEdit && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          aria-label="Remove from queue"
          className="opacity-0 group-hover:opacity-100 text-scroll-400 hover:text-ember transition-opacity shrink-0"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function QueueList({
  queue,
  currentIndex,
  canEdit,
  onSelect,
  onRemove,
  onAddClick,
  onReorder,
}: {
  queue: QueueTrack[]
  currentIndex: number
  canEdit: boolean
  onSelect: (index: number) => void
  onRemove: (track: QueueTrack) => void
  onAddClick: () => void
  onReorder: (reordered: QueueTrack[]) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, collisions } = event
    const target = [...(collisions ?? [])]
      .filter(c => c.id !== active.id)
      .sort((a, b) => (a.data?.value ?? Infinity) - (b.data?.value ?? Infinity))[0]
    if (!target) return

    const oldIndex = queue.findIndex(t => t.id === active.id)
    const newIndex = queue.findIndex(t => t.id === target.id)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    onReorder(arrayMove(queue, oldIndex, newIndex))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-scroll-400">Up next</span>
        {canEdit && (
          <button
            onClick={onAddClick}
            aria-label="Add music"
            className="shrink-0 transition-colors text-scroll-400/40 hover:text-scroll-100"
          >
            <Plus size={15} />
          </button>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {!queue.length && (
          <p className="text-xs text-scroll-400 px-2.5 py-2">No tracks yet.</p>
        )}
        {canEdit ? (
          <DndContext
            id="queue-list"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext items={queue.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {queue.map((track, i) => (
                <SortableTrackRow
                  key={track.id}
                  track={track}
                  isCurrent={i === currentIndex}
                  canEdit={canEdit}
                  onSelect={() => onSelect(i)}
                  onRemove={() => onRemove(track)}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          queue.map((track, i) => (
            <div
              key={track.id}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                i === currentIndex ? 'bg-scroll-100/10 text-scroll-100' : 'text-scroll-300 hover:bg-scroll-100/5'
              }`}
              onClick={() => onSelect(i)}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{track.title}</div>
                <div className="truncate text-xs text-scroll-400">{track.artist}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
