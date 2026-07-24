'use client'
import { useState } from 'react'
import { deletePost } from '@/lib/actions/gallery'

export function DeletePostButton({ postId }: { postId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="btn-ghost text-ember border-ember/30 hover:border-ember/50 hover:bg-ember/5">
        Delete
      </button>
    )
  }

  async function handleDelete() {
    setDeleting(true)
    setError('')
    const result = await deletePost(postId)
    if (result?.error) { setError(result.error); setDeleting(false) }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-ink-500">Delete this post?</span>
      <button disabled={deleting} onClick={handleDelete} className="btn-danger">
        {deleting ? 'Deleting…' : 'Confirm'}
      </button>
      <button onClick={() => setConfirming(false)} className="btn-ghost">Cancel</button>
      {error && <span className="text-xs text-ember">{error}</span>}
    </div>
  )
}
