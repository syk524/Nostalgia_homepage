'use client'
import { useRef, useState } from 'react'
import { Link as LinkIcon, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadAudio } from '@/lib/upload'
import { addYoutubeTrack, addUploadedTrack } from '@/lib/actions/playlist'
import type { PlaylistTrack } from '@/types/database'

export function AddTrackForm({
  onAdded,
  onClose,
}: {
  onAdded: (track: PlaylistTrack) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'youtube' | 'upload'>('youtube')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleYoutubeFetch(value: string) {
    setUrl(value)
    const match = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/)
    const videoId = match?.[1] ?? (/^[\w-]{11}$/.test(value.trim()) ? value.trim() : null)
    if (!videoId || title) return
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      if (res.ok) {
        const data = await res.json()
        if (data.title) setTitle(data.title)
      }
    } catch {
      // best-effort only; user can still type the title manually
    }
  }

  async function handleYoutubeSubmit() {
    if (!url.trim()) return
    setBusy(true)
    setError(null)
    const { track, error } = await addYoutubeTrack(url, title, artist)
    setBusy(false)
    if (error || !track) { setError(error ?? 'Could not add track.'); return }
    onAdded(track)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBusy(false); setError('You must be signed in.'); return }
    const { path, error: uploadErr } = await uploadAudio(file, user.id, 'playlist-audio')
    if (uploadErr || !path) { setBusy(false); setError(uploadErr ?? 'Upload failed.'); return }
    const { track, error } = await addUploadedTrack(path, title || file.name.replace(/\.[^.]+$/, ''), artist)
    setBusy(false)
    if (error || !track) { setError(error ?? 'Could not add track.'); return }
    onAdded(track)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="label mb-0">Add music</span>
        <button onClick={onClose} className="text-ink/40 hover:text-ink text-xs">Close</button>
      </div>

      <div className="flex gap-1 text-xs">
        <button
          onClick={() => setTab('youtube')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded ${tab === 'youtube' ? 'bg-ink text-white' : 'bg-ink/5 text-ink/60'}`}
        >
          <LinkIcon size={12} /> YouTube
        </button>
        <button
          onClick={() => setTab('upload')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded ${tab === 'upload' ? 'bg-ink text-white' : 'bg-ink/5 text-ink/60'}`}
        >
          <Upload size={12} /> Upload MP3
        </button>
      </div>

      {tab === 'youtube' ? (
        <div className="space-y-2">
          <input
            className="input text-sm py-1.5"
            placeholder="YouTube link"
            value={url}
            onChange={e => handleYoutubeFetch(e.target.value)}
          />
          <input
            className="input text-sm py-1.5"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <input
            className="input text-sm py-1.5"
            placeholder="Artist"
            value={artist}
            onChange={e => setArtist(e.target.value)}
          />
          <button onClick={handleYoutubeSubmit} disabled={busy || !url.trim()} className="btn-primary w-full justify-center text-sm">
            {busy ? 'Adding…' : 'Add track'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            className="input text-sm py-1.5"
            placeholder="Title (optional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <input
            className="input text-sm py-1.5"
            placeholder="Artist (optional)"
            value={artist}
            onChange={e => setArtist(e.target.value)}
          />
          <input ref={fileRef} type="file" accept="audio/mpeg,audio/mp3" className="sr-only" onChange={handleFileChange} disabled={busy} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-ghost w-full justify-center text-sm">
            {busy ? 'Uploading…' : 'Choose MP3 file'}
          </button>
        </div>
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  )
}
