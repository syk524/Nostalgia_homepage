'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchQueue, type QueueTrack } from '@/lib/playlist'
import { removeTrack } from '@/lib/actions/playlist'
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
      } else if (audioRef.current) {
        setElapsedSeconds(audioRef.current.currentTime)
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

  function handlePrev() {
    setCurrentIndex(i => (i > 0 ? i - 1 : loopMode !== 'off' ? queue.length - 1 : 0))
    setIsPlaying(true)
  }

  function handleNext() {
    // Manual skip always advances, even in loop-one mode.
    setCurrentIndex(i => {
      const next = i + 1
      if (next < queue.length) return next
      return loopMode !== 'off' ? 0 : i
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
        loopMode={loopMode}
        userId={userId}
        canEdit={canEdit}
        onPlayPause={handlePlayPause}
        onPrev={handlePrev}
        onNext={handleNext}
        onSelect={handleSelect}
        onShuffle={handleShuffle}
        onRemove={handleRemove}
        onTrackAdded={handleTrackAdded}
      />
    </>
  )
}
