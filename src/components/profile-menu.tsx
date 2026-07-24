'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadImage } from '@/lib/upload'
import { logout } from '@/lib/actions/auth'
import type { Profile } from '@/types/database'

function NavDot() {
  return <span className="nav-dot text-ink" />
}

export function ProfileMenu({ profile }: { profile: Profile }) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(profile.display_name || profile.username)
  const [iconUrl, setIconUrl] = useState(profile.user_icon_url || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

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

  async function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { url } = await uploadImage(file, profile.id, 'user-icons')
    if (url) setIconUrl(url)
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({
      display_name: displayName || null,
      user_icon_url: iconUrl || null,
    }).eq('id', profile.id)
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

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
        <div className="card absolute bottom-full left-0 mb-3 w-64 p-5 space-y-4 normal-case tracking-normal">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 shrink-0">
              {iconUrl
                ? <img src={iconUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
                : <div className="w-14 h-14 rounded-full bg-scroll-200 flex items-center justify-center text-lg text-ink-500">
                    {displayName?.[0]?.toUpperCase() ?? '?'}
                  </div>
              }
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-ink rounded-full flex items-center justify-center text-white text-xs"
              >
                {uploading ? '…' : '+'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="sr-only"
                onChange={handleIconUpload} disabled={uploading} />
            </div>
            <input
              className="input flex-1 text-sm py-1.5"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Nickname"
            />
          </div>

          <button onClick={handleSave} disabled={saving || uploading} className="btn-primary w-full justify-center text-sm">
            {saving ? 'Saving…' : 'Save'}
          </button>

          <form action={logout}>
            <button className="w-full text-left text-sm text-ink-500 hover:text-ember transition-colors">
              Log Out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
