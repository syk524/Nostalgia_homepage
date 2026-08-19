'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchQueue, type QueueTrack } from '@/lib/playlist'
import { removeTrack, reorderTracks } from '@/lib/actions/playlist'
import type { PlaylistTrack } from '@/types/database'
import { DockMusicWidget } from './dock-music-widget'
import { YoutubeFrame, YT_TARGET_ID } from './youtube-frame'

export type LoopMode = 'off' | 'all' | 'one'

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

export function SoundPlayer() {
  const [userId, setUserId] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [queue, setQueue] = useState<QueueTrack[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  // Read live off the actual player, not track.duration_seconds —
  // addYoutubeTrack/addUploadedTrack (lib/actions/playlist.ts) both
  // hardcode that DB column to null at save time regardless of source,
  // so the total half of the dock's time display was permanently
  // stuck at 0:00 for every track, not just YouTube ones.
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [loopMode, setLoopMode] = useState<LoopMode>('all')
  const [collapsed, setCollapsed] = useState(false)
  const [ytReady, setYtReady] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const ytPlayerRef = useRef<any>(null)
  const ytPlayerCreatedRef = useRef(false)
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queueRef = useRef<QueueTrack[]>([])
  const currentIndexRef = useRef(0)
  const loopModeRef = useRef<LoopMode>('all')

  queueRef.current = queue
  currentIndexRef.current = currentIndex
  loopModeRef.current = loopMode

  const current = queue[currentIndex]

  // auth state — also resolves edit authority (role) for the "Add music" gate
  useEffect(() => {
    const supabase = createClient()

    async function resolveRole(uid: string | null) {
      if (!uid) { setCanEdit(false); return }
      const { data } = await supabase.from('profiles').select('role').eq('id', uid).single()
      setCanEdit(data?.role === 'editor' || data?.role === 'admin')
    }

    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      resolveRole(uid)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null
      setUserId(uid)
      resolveRole(uid)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // load the shared queue once on mount
  useEffect(() => {
    fetchQueue().then(q => {
      setQueue(q)
      setCurrentIndex(i => (i < q.length ? i : 0))
    })
  }, [])

  // Called when the current track finishes naturally (not via prev/next).
  const advanceQueue = useCallback(() => {
    if (loopModeRef.current === 'one') {
      const track = queueRef.current[currentIndexRef.current]
      if (!track) return
      if (track.source === 'youtube') {
        ytPlayerRef.current?.seekTo?.(0, true)
        ytPlayerRef.current?.playVideo?.()
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
      }
      return
    }
    const q = queueRef.current
    setCurrentIndex(i => {
      const next = i + 1
      if (next < q.length) return next
      if (loopModeRef.current === 'all') return 0
      setIsPlaying(false)
      return i
    })
  }, [])

  // YouTube IFrame API setup — guarded against React Strict Mode's
  // dev-mode double-invoke so we never construct two YT.Player instances.
  useEffect(() => {
    if (ytPlayerCreatedRef.current) return
    ytPlayerCreatedRef.current = true

    function createPlayer() {
      ytPlayerRef.current = new window.YT.Player(YT_TARGET_ID, {
        height: '0',
        width: '0',
        playerVars: { controls: 0 },
        events: {
          onReady: () => setYtReady(true),
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.ENDED) advanceQueue()
            if (event.data === window.YT.PlayerState.PLAYING) setIsPlaying(true)
            if (event.data === window.YT.PlayerState.PAUSED) setIsPlaying(false)
          },
        },
      })
    }

    if (window.YT?.Player) {
      createPlayer()
      return
    }

    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.()
      createPlayer()
    }

    if (!document.getElementById('youtube-iframe-api')) {
      const script = document.createElement('script')
      script.id = 'youtube-iframe-api'
      script.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(script)
    }
    // Intentionally no cleanup that destroys the player — this component
    // is meant to stay mounted for the app's lifetime.
  }, [advanceQueue])

  // switch source when the current track changes
  useEffect(() => {
    if (!current) return
    const audio = audioRef.current
    const yt = ytPlayerRef.current

    if (current.source === 'youtube') {
      audio?.pause()
      if (ytReady && yt?.loadVideoById) {
        if (isPlaying) yt.loadVideoById(current.source_ref)
        else yt.cueVideoById(current.source_ref)
      }
    } else {
      if (ytReady && yt?.stopVideo) yt.stopVideo()
      if (audio) {
        const supabase = createClient()
        const { data } = supabase.storage.from('playlist-audio').getPublicUrl(current.source_ref)
        audio.src = data.publicUrl
        audio.load()
        if (isPlaying) audio.play().catch(() => {})
      }
    }
    setElapsedSeconds(0)
    setDurationSeconds(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, ytReady])

  // play/pause reacts to isPlaying toggling for the active source
  useEffect(() => {
    if (!current) return
    if (current.source === 'youtube') {
      if (!ytReady || !ytPlayerRef.current) return
      if (isPlaying) ytPlayerRef.current.playVideo?.()
      else ytPlayerRef.current.pauseVideo?.()
    } else {
      const audio = audioRef.current
      if (!audio) return
      if (isPlaying) audio.play().catch(() => {})
      else audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  // elapsed time polling, unified across both source types
  useEffect(() => {
    elapsedIntervalRef.current = setInterval(() => {
      const track = queueRef.current[currentIndexRef.current]
      if (!track) return
      if (track.source === 'youtube') {
        const yt = ytPlayerRef.current
        if (typeof yt?.getCurrentTime === 'function') setElapsedSeconds(yt.getCurrentTime())
        if (typeof yt?.getDuration === 'function') setDurationSeconds(yt.getDuration() || 0)
      } else if (audioRef.current) {
        setElapsedSeconds(audioRef.current.currentTime)
        setDurationSeconds(Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0)
      }
    }, 500)
    return () => {
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current)
    }
  }, [])

  function handleAudioEnded() {
    advanceQueue()
  }

  function handlePlayPause() {
    setIsPlaying(v => !v)
  }

  function handleCycleLoop() {
    setLoopMode(m => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off')
  }

  // Manual skip always wraps around, regardless of loop mode — loop
  // only governs what happens when a track ends on its own (see
  // advanceQueue above); pressing prev/next is a direct request to
  // move to a specific track, so first-song-previous goes to the last
  // song and last-song-next goes to the first, even with loop off.
  function handlePrev() {
    setCurrentIndex(i => (i > 0 ? i - 1 : queue.length - 1))
    setIsPlaying(true)
  }

  function handleNext() {
    setCurrentIndex(i => {
      const next = i + 1
      return next < queue.length ? next : 0
    })
    setIsPlaying(true)
  }

  function handleSelect(index: number) {
    setCurrentIndex(index)
    setIsPlaying(true)
  }

  function handleShuffle() {
    // Local-only: reorders this visitor's playback session without
    // touching the shared catalog order everyone else sees.
    const rest = queue.filter((_, i) => i !== currentIndex)
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[rest[i], rest[j]] = [rest[j], rest[i]]
    }
    const shuffled = [current, ...rest].filter(Boolean) as QueueTrack[]
    setQueue(shuffled.map((t, i) => ({ ...t, queuePosition: i })))
    setCurrentIndex(0)
  }

  async function handleRemove(track: QueueTrack) {
    if (!canEdit) return
    await removeTrack(track.id)
    const prevQueue = queueRef.current
    const removedIndex = prevQueue.findIndex(t => t.id === track.id)
    const next = prevQueue.filter(t => t.id !== track.id)
    setQueue(next.map((t, i) => ({ ...t, queuePosition: i })))
    setCurrentIndex(i => {
      if (removedIndex < 0) return i
      if (removedIndex < i) return i - 1
      return Math.min(i, Math.max(0, next.length - 1))
    })
  }

  function handleTrackAdded(track: PlaylistTrack) {
    setQueue(q => [...q, { ...track, queuePosition: q.length }])
  }

  // currentIndex is a plain array position, not a track id — QueueList
  // already refuses to let the currently-playing row itself be picked
  // up and dragged (see SortableTrackRow's useSortable `disabled`), but
  // dragging OTHER tracks around it still shifts its position purely as
  // a side effect (e.g. moving a later track earlier pushes the current
  // one back by one slot). Re-deriving currentIndex by the current
  // track's own id after every reorder — rather than trusting the old
  // index number — is what actually keeps playback pointed at the same
  // song regardless of how the rest of the queue gets rearranged.
  function handleReorder(reordered: QueueTrack[]) {
    const currentTrackId = queueRef.current[currentIndexRef.current]?.id
    const nextQueue = reordered.map((t, i) => ({ ...t, queuePosition: i }))
    setQueue(nextQueue)
    if (currentTrackId) {
      const newIndex = nextQueue.findIndex(t => t.id === currentTrackId)
      if (newIndex !== -1) setCurrentIndex(newIndex)
    }
    reorderTracks(nextQueue.map(t => t.id))
  }

  // Hardware/OS-level transport controls — a headset's play/pause
  // button, a lock-screen widget, a laptop's media keys — normally
  // reach straight past React and toggle the underlying <audio>
  // element directly (the browser's default behavior for a page with
  // no registered handlers), which changed actual playback but left
  // isPlaying, and so the dock's own play/pause icon, never told.
  // Registering explicit handlers routes those controls through the
  // exact same state setters the in-app buttons use, so the UI can't
  // drift from real playback regardless of what triggered the change.
  // 'play'/'pause' are separate explicit actions here, not a toggle —
  // more correct than reusing handlePlayPause, since the OS is telling
  // us which one happened rather than asking us to flip a coin.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true))
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false))
    navigator.mediaSession.setActionHandler('previoustrack', handlePrev)
    navigator.mediaSession.setActionHandler('nexttrack', handleNext)
    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopMode, queue.length])

  // Keeps the OS's own play/pause affordance (lock screen, headset UI)
  // showing the correct icon even when playback started or stopped for
  // a reason other than a hardware button — e.g. picking a track from
  // the queue, or a track ending and the next one auto-starting.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  // Track metadata for the same OS-level surfaces, so they show the
  // actual song instead of a generic "this page is playing audio."
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return
    navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: current.artist ?? undefined })
  }, [current])

  return (
    <>
      <YoutubeFrame />
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />

      <DockMusicWidget
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(v => !v)}
        queue={queue}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        elapsedSeconds={elapsedSeconds}
        durationSeconds={durationSeconds}
        loopMode={loopMode}
        userId={userId}
        canEdit={canEdit}
        onPlayPause={handlePlayPause}
        onCycleLoop={handleCycleLoop}
        onPrev={handlePrev}
        onNext={handleNext}
        onSelect={handleSelect}
        onShuffle={handleShuffle}
        onRemove={handleRemove}
        onReorder={handleReorder}
        onTrackAdded={handleTrackAdded}
      />
    </>
  )
}
