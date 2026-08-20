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

// A handful of navigations (closing a post, deleting one, adding one,
// switching gallery category while a post is open) all have to force a
// full page reload rather than a soft Next.js navigation — the
// @modal parallel-route slot (post-modal.tsx) doesn't reliably clear
// on a client-side router.push in this Next.js version (confirmed:
// the URL updates but the modal stays visibly rendered on top), so
// window.location.href is the only thing that actually works. Since
// SoundPlayer lives in the root layout, a hard reload remounts it from
// scratch and would normally wipe playback entirely. Rather than
// chasing every hard-nav call site, SoundPlayer persists just enough
// (which track, paused or not, how far in, loop mode) to this
// browser tab's own sessionStorage and rehydrates it once on mount —
// makes the reload itself invisible instead of trying to prevent it.
const PLAYBACK_STORAGE_KEY = 'sound-player-playback'
type StoredPlayback = { trackId: string; isPlaying: boolean; elapsedSeconds: number; loopMode: LoopMode }

function readStoredPlayback(): StoredPlayback | null {
  try {
    const raw = sessionStorage.getItem(PLAYBACK_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// YouTube IFrame API error codes: https://developers.google.com/youtube/iframe_api_reference#onError
function youtubeErrorMessage(code: number): string {
  switch (code) {
    case 101:
    case 150:
      return 'Playback blocked by the video owner'
    case 100:
      return 'Video not found or private'
    case 2:
      return 'Invalid video link'
    default:
      return 'Video failed to play'
  }
}

function writeStoredPlayback(state: StoredPlayback) {
  try {
    sessionStorage.setItem(PLAYBACK_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable (private mode, quota) — playback still works
    // for this page view, it just won't survive the next hard reload.
  }
}

// A real user preference (not a same-tab-reload workaround like
// PLAYBACK_STORAGE_KEY above), so this is localStorage — persists
// across tabs and browser restarts, like calendar-desk-widget.tsx's
// own open/closed state.
const VOLUME_STORAGE_KEY = 'sound-player-volume'

function readStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (raw === null) return 100
    const n = Number(raw)
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 100
  } catch {
    return 100
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
  // Set from the YouTube player's onError — some videos (typically
  // label/VEVO uploads) have embedding disabled by the rights holder,
  // which the IFrame API can only report after actually trying to cue
  // the video, not at add-track time. Without this, a track like that
  // just sits there cued-but-silent forever with no indication why.
  const [playError, setPlayError] = useState<string | null>(null)
  const [volume, setVolume] = useState(100)

  const audioRef = useRef<HTMLAudioElement>(null)
  const ytPlayerRef = useRef<any>(null)
  const ytPlayerCreatedRef = useRef(false)
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queueRef = useRef<QueueTrack[]>([])
  const currentIndexRef = useRef(0)
  const loopModeRef = useRef<LoopMode>('all')
  const isPlayingRef = useRef(false)
  // Set once, from sessionStorage, the moment the restored track first
  // becomes `current` — the "switch source" effect below consumes and
  // clears it, seeking the freshly-loaded source to this position
  // instead of starting over at 0.
  const pendingSeekRef = useRef<number | null>(null)
  // Set right before cueVideoById() when the switch should end up playing.
  // Calling playVideo() immediately after cueVideoById() is a race — both
  // are async postMessage calls into the iframe, and playVideo() can land
  // before the cue actually finishes loading the new video, so it's a
  // no-op and playback stays stuck at CUED. Deferring the playVideo() call
  // to onStateChange, once the CUED state confirms the new video is
  // actually loaded, removes the race entirely.
  const autoplayOnCueRef = useRef(false)

  queueRef.current = queue
  currentIndexRef.current = currentIndex
  loopModeRef.current = loopMode
  isPlayingRef.current = isPlaying

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

  // load the shared queue once on mount, resuming a persisted position
  // if this tab has one and the track it points to still exists
  useEffect(() => {
    fetchQueue().then(q => {
      setQueue(q)
      const stored = readStoredPlayback()
      const restoredIndex = stored ? q.findIndex(t => t.id === stored.trackId) : -1
      if (stored && restoredIndex !== -1) {
        setCurrentIndex(restoredIndex)
        setLoopMode(stored.loopMode)
        setIsPlaying(stored.isPlaying)
        pendingSeekRef.current = stored.elapsedSeconds
      } else {
        setCurrentIndex(i => (i < q.length ? i : 0))
      }
    })
  }, [])

  // Read once on mount (not a lazy useState initializer) purely to
  // match every other localStorage read in this codebase, which all
  // read after mount rather than during the initial render.
  useEffect(() => {
    setVolume(readStoredVolume())
  }, [])

  useEffect(() => {
    try { localStorage.setItem(VOLUME_STORAGE_KEY, String(volume)) } catch {
      // Storage unavailable — volume still works this page view, it
      // just resets to 100 next visit.
    }
  }, [volume])

  // Applies to both source types unconditionally, rather than only the
  // currently-active one — each API is a harmless no-op on the inactive
  // element/player, and this way volume doesn't need to be re-applied
  // every time `current` switches source type. ytReady is a dependency
  // (not just volume) so a change made before the YT player finishes
  // initializing still gets applied once it does, instead of the
  // player silently starting at its own default volume.
  useEffect(() => {
    if (ytReady && ytPlayerRef.current?.setVolume) ytPlayerRef.current.setVolume(volume)
    if (audioRef.current) audioRef.current.volume = volume / 100
  }, [volume, ytReady])

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
            if (event.data === window.YT.PlayerState.CUED && autoplayOnCueRef.current) {
              autoplayOnCueRef.current = false
              ytPlayerRef.current?.playVideo?.()
            }
            if (event.data === window.YT.PlayerState.ENDED) advanceQueue()
            if (event.data === window.YT.PlayerState.PLAYING) { setIsPlaying(true); setPlayError(null) }
            if (event.data === window.YT.PlayerState.PAUSED) setIsPlaying(false)
          },
          // Most commonly a track whose owner disabled embedding (error
          // 101/150) — the IFrame API only surfaces that once it actually
          // tries to cue the video, so this is the first point the app
          // can know playback is impossible rather than just slow.
          onError: (event: any) => {
            autoplayOnCueRef.current = false
            setIsPlaying(false)
            setPlayError(youtubeErrorMessage(event.data))
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

  // switch source when the current track changes. seekTo (from a
  // restored session, see pendingSeekRef above) is only actually
  // consumed once it's been acted on — for a YouTube track that isn't
  // ready yet, this effect re-runs once ytReady flips true, and the
  // still-pending seek needs to survive until that real run.
  useEffect(() => {
    if (!current) return
    const audio = audioRef.current
    const yt = ytPlayerRef.current
    const seekTo = pendingSeekRef.current
    setPlayError(null)

    if (current.source === 'youtube') {
      audio?.pause()
      // loadVideoById is documented to autoplay on its own, but calling it
      // again shortly after a previous loadVideoById/cueVideoById — e.g.
      // two YouTube tracks back to back via Next/Prev — can leave the
      // player stuck at CUED instead of actually playing (confirmed via
      // the onStateChange trace: the implicit autoplay silently drops if
      // the previous video's load hadn't fully settled yet). cueVideoById
      // always, with autoplayOnCueRef flagging whether onStateChange
      // should fire playVideo() once the CUED state confirms the new
      // video is actually loaded — calling playVideo() synchronously
      // right after cueVideoById() was tried first and is itself racy
      // (both are async postMessage calls into the iframe; playVideo()
      // can arrive before the cue finishes and become a no-op).
      if (ytReady && yt?.cueVideoById) {
        autoplayOnCueRef.current = isPlaying
        yt.cueVideoById(current.source_ref, seekTo ?? undefined)
        pendingSeekRef.current = null
      }
    } else {
      if (ytReady && yt?.stopVideo) yt.stopVideo()
      if (audio) {
        const supabase = createClient()
        const { data } = supabase.storage.from('playlist-audio').getPublicUrl(current.source_ref)
        audio.src = data.publicUrl
        audio.load()
        if (seekTo) {
          const applySeek = () => {
            audio.currentTime = seekTo
            audio.removeEventListener('loadedmetadata', applySeek)
          }
          audio.addEventListener('loadedmetadata', applySeek)
        }
        if (isPlaying) audio.play().catch(() => {})
        pendingSeekRef.current = null
      }
    }
    setElapsedSeconds(seekTo ?? 0)
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

  // elapsed time polling, unified across both source types — also the
  // spot that keeps sessionStorage current, so whichever position was
  // last polled (at most 500ms stale) is what a forced hard reload
  // elsewhere in the app (closing/deleting/adding a post) resumes from.
  useEffect(() => {
    elapsedIntervalRef.current = setInterval(() => {
      const track = queueRef.current[currentIndexRef.current]
      if (!track) return
      let elapsed = 0
      if (track.source === 'youtube') {
        const yt = ytPlayerRef.current
        if (typeof yt?.getCurrentTime === 'function') elapsed = yt.getCurrentTime()
        if (typeof yt?.getDuration === 'function') setDurationSeconds(yt.getDuration() || 0)
      } else if (audioRef.current) {
        elapsed = audioRef.current.currentTime
        setDurationSeconds(Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0)
      }
      setElapsedSeconds(elapsed)
      writeStoredPlayback({ trackId: track.id, isPlaying: isPlayingRef.current, elapsedSeconds: elapsed, loopMode: loopModeRef.current })
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

  function handleVolumeChange(v: number) {
    setVolume(Math.min(100, Math.max(0, v)))
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

  // Appends only — adding a track queues it without disturbing whatever
  // is currently playing. (Briefly auto-selected + played the new track
  // here, matching handleSelect; reverted since that jumped away from
  // whatever the listener already had playing, which wasn't wanted.)
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
      {/* onPlay is purely additive confirmation that actual playback
          started — safe to trust unconditionally, since nothing in
          this component ever wants isPlaying flipped true unless
          audio genuinely started. Deliberately no onPause here: a
          track change reassigns audio.src and calls .load(), which
          makes the browser fire its own native `pause` event as part
          of resetting the element — completely unrelated to the user
          pausing anything, but indistinguishable from a real pause to
          a plain onPause handler. That clobbered the isPlaying:true a
          track change had just set, so next/prev silently landed on
          the new track paused instead of continuing to play. */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onPlay={() => setIsPlaying(true)}
        className="hidden"
      />

      <DockMusicWidget
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(v => !v)}
        queue={queue}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        elapsedSeconds={elapsedSeconds}
        durationSeconds={durationSeconds}
        playError={playError}
        loopMode={loopMode}
        volume={volume}
        userId={userId}
        canEdit={canEdit}
        onPlayPause={handlePlayPause}
        onCycleLoop={handleCycleLoop}
        onVolumeChange={handleVolumeChange}
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
