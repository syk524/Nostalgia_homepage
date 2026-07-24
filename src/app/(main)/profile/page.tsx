'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage } from '@/lib/upload'
import type { Profile } from '@/types/database'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm]       = useState({ display_name: '', bio: '', username: '' })
  const [iconUrl, setIconUrl]  = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]    = useState(false)
  const [msg, setMsg]          = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            setProfile(data)
            setForm({ display_name: data.display_name ?? '', bio: data.bio ?? '', username: data.username })
            setIconUrl(data.user_icon_url ?? '')
          }
        })
    })
  }, [])

  async function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    const { url, error } = await uploadImage(file, profile.id, 'user-icons')
    if (error) { setMsg({ type: 'err', text: error }); setUploading(false); return }
    if (url) setIconUrl(url)
    setUploading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    setMsg(null)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({
      display_name: form.display_name || null,
      bio: form.bio || null,
      user_icon_url: iconUrl || null,
    }).eq('id', profile.id)

    setMsg(error
      ? { type: 'err', text: error.message }
      : { type: 'ok', text: 'Profile saved.' })
    setSaving(false)
  }

  if (!profile) return <div className="animate-fade-up"><p className="text-ink-500">Loading…</p></div>

  return (
    <div className="animate-fade-up max-w-lg space-y-6">
      <div>
        <h2 className="text-3xl text-ink">Profile</h2>
        <p className="text-ink-500 mt-1">
          Nickname, avatar, and bio. Role: <span className="badge">{profile.role}</span>
        </p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="label">Avatar</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-scroll-300 overflow-hidden flex items-center justify-center bg-scroll-100 shrink-0">
                {iconUrl
                  ? <img src={iconUrl} alt="avatar preview" className="w-full h-full object-cover" />
                  : <span className="text-2xl text-scroll-400">◯</span>
                }
              </div>
              <label className="btn-ghost text-xs cursor-pointer">
                {uploading ? 'Uploading…' : 'Choose image'}
                <input type="file" accept="image/*" onChange={handleIconUpload}
                  className="sr-only" disabled={uploading} />
              </label>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="username">Username</label>
            <input id="username" className="input bg-scroll-100 cursor-not-allowed"
              value={form.username} readOnly title="Username cannot be changed" />
            <p className="text-xs text-ink-500 mt-1">Username can&apos;t be changed after signup.</p>
          </div>

          <div>
            <label className="label" htmlFor="display_name">Nickname</label>
            <input id="display_name" className="input" value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="What others will see you as" />
          </div>

          <div>
            <label className="label" htmlFor="bio">Bio</label>
            <textarea id="bio" rows={3} className="textarea" value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="A short introduction" />
          </div>

          {msg && (
            <p className={`text-sm px-4 py-2.5 rounded border ${
              msg.type === 'ok'
                ? 'text-sage-700 bg-sage-50 border-sage-200'
                : 'text-ember bg-ember/10 border-ember/20'
            }`}>
              {msg.text}
            </p>
          )}

          <button type="submit" disabled={saving || uploading} className="btn-primary">
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}
