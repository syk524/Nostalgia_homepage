'use client'
import { useState } from 'react'
import { createCategory } from '@/lib/actions/categories'
import type { Category } from '@/types/database'

export function CategoryPicker({
  categories,
  selectedId,
  onChange,
  onCategoryCreated,
}: {
  categories: Category[]
  selectedId: string | null
  onChange: (id: string) => void
  onCategoryCreated: (category: Category) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    setError('')
    const result = await createCategory(name.trim())
    setCreating(false)
    if (result.error || !result.category) {
      setError(result.error ?? 'Could not create category.')
      return
    }
    onCategoryCreated(result.category)
    onChange(result.category.id)
    setName('')
    setAdding(false)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {categories.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            aria-pressed={selectedId === cat.id}
            className={selectedId === cat.id ? 'pill pill-active' : 'pill'}
          >
            {cat.name}
          </button>
        ))}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="pill pill-dashed">
            + New
          </button>
        )}
        {adding && (
          // A plain div, not a <form> — this already sits inside the post
          // form's own <form>, and nested <form> elements are invalid HTML
          // (the browser's parser doesn't nest them the way JSX implies,
          // which previously caused the outer form to submit/reset instead
          // of just creating the category).
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={name}
              maxLength={40}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
              placeholder="Category name"
              className="input !w-36 !py-1 !px-2.5 text-xs"
            />
            <button type="button" onClick={handleCreate} disabled={creating || !name.trim()} className="pill pill-active">
              {creating ? '…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setName(''); setError('') }}
              className="pill"
            >
              ✕
            </button>
          </div>
        )}
      </div>
      {error && <p className="field-error text-xs pt-1.5">{error}</p>}
    </div>
  )
}
