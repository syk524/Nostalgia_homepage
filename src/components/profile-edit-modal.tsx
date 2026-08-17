'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { ProfileForm } from '@/components/profile-form'
import type { Profile } from '@/types/database'

export function ProfileEditModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  // Portal onto <body> — this opens from the nav, which (like the image
  // focal editor) sits under ancestors carrying animate-fade-up/slide-up
  // classes. Those leave a permanent transform on the element even after
  // the animation ends, which turns it into the containing block for any
  // fixed-position descendant, trapping a non-portaled overlay inside that
  // ancestor's box instead of the real viewport.
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSaved() {
    router.refresh()
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 backdrop-blur-sm p-6 overflow-y-auto" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 space-y-5 my-auto max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl text-ink">Profile</h2>
            <p className="text-ink-500 text-sm mt-1">
              Nickname, avatar, and bio. Role: <span className="badge">{profile.role}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full hover:bg-scroll-200 text-ink flex items-center justify-center transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <ProfileForm profile={profile} onSaved={handleSaved} />
      </div>
    </div>,
    document.body,
  )
}
