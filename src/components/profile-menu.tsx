'use client'
import { useEffect, useRef, useState } from 'react'
import { logout } from '@/lib/actions/auth'
import { ProfileEditModal } from '@/components/profile-edit-modal'
import type { Profile } from '@/types/database'

// No text-ink here — color comes from the ancestor's `color` (bg-current
// in .nav-dot), same as Nav's own NavDot (see nav.tsx), so a per-page
// --nav-icon-color override (e.g. character-pair-detail.tsx) reaches this
// dot too instead of it staying fixed at the default ink color.
function NavDot() {
  return <span className="nav-dot" />
}

export function ProfileMenu({ profile }: { profile: Profile }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 hover:opacity-70 transition-opacity"
      >
        <NavDot />
        {profile.display_name || profile.username}
      </button>

      {open && (
        <div className="card absolute bottom-full left-0 mb-3 w-48 p-2 space-y-1 normal-case tracking-normal">
          <button
            onClick={() => { setOpen(false); setEditOpen(true) }}
            className="w-full text-left text-sm px-3 py-2 rounded hover:bg-scroll-100 transition-colors"
          >
            Update Profile
          </button>
          <form action={logout}>
            <button className="w-full text-left text-sm px-3 py-2 rounded hover:bg-scroll-100 text-ink-500 hover:text-ember transition-colors">
              Log Out
            </button>
          </form>
        </div>
      )}

      {editOpen && <ProfileEditModal profile={profile} onClose={() => setEditOpen(false)} />}
    </div>
  )
}
