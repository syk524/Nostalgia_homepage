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
        <span className="font-mono text-[10px] uppercase tracking-widest text-scroll-400">Add music</span>
        <button onClick={onClose} className="text-scroll-400 hover:text-scroll-100 text-xs transition-colors">Close</button>
      </div>

      <div className="flex gap-1 rounded-lg bg-scroll-100/5 p-1 text-xs">
        <button
          onClick={() => setTab('youtube')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md transition-colors ${tab === 'youtube' ? 'bg-scroll-100 text-ink-900 shadow-sm' : 'text-scroll-400 hover:text-scroll-100'}`}
        >
          <LinkIcon size={12} /> YouTube
        </button>
        <button
          onClick={() => setTab('upload')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md transition-colors ${tab === 'upload' ? 'bg-scroll-100 text-ink-900 shadow-sm' : 'text-scroll-400 hover:text-scroll-100'}`}
        >
          <Upload size={12} /> Upload MP3
        </button>
      </div>

      {/* Explicit keys on every input across both branches — without
          them React reconciles by position, not identity: the youtube
          branch has an extra field (URL) ahead of Title/Artist that the
          upload branch doesn't, so switching tabs shifted everything by
          one slot and matched the Artist text input's old DOM node
          against the upload branch's hidden file input at that same
          position — value went from a controlled string to file inputs'
          undefined (they can't be value-controlled), which is exactly
          the "changing a controlled input to be uncontrolled" warning.
          Shared keys ("title"/"artist") let those two fields' state
          carry over seamlessly between tabs since they really are the
          same field either way; "url" and "file" get their own keys so
          they're never confused with anything else. */}
      {tab === 'youtube' ? (
        <div className="space-y-2">
          <input
            key="url"
            className="dark-input"
            placeholder="YouTube link"
            value={url}
            onChange={e => handleYoutubeFetch(e.target.value)}
          />
          <input
            key="title"
            className="dark-input"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <input
            key="artist"
            className="dark-input"
            placeholder="Artist"
            value={artist}
            onChange={e => setArtist(e.target.value)}
          />
          <button
            onClick={handleYoutubeSubmit}
            disabled={busy || !url.trim() || !title.trim() || !artist.trim()}
            className="w-full justify-center flex items-center gap-2 py-2 rounded bg-scroll-100 text-ink-900 text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Adding…' : 'Add track'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            key="title"
            className="dark-input"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <input
            key="artist"
            className="dark-input"
            placeholder="Artist"
            value={artist}
            onChange={e => setArtist(e.target.value)}
          />
          <input key="file" ref={fileRef} type="file" accept="audio/mpeg,audio/mp3" className="sr-only" onChange={handleFileChange} disabled={busy} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy || !title.trim() || !artist.trim()}
            className="w-full justify-center flex items-center gap-2 py-2 rounded-full text-scroll-100 text-sm font-medium border border-scroll-100/20 hover:border-scroll-100/40 hover:bg-scroll-100/5 active:scale-[0.98] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Uploading…' : 'Choose MP3 file'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-ember mt-1.5">{error}</p>}
    </div>
  )
}
