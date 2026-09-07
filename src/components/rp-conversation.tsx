'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, X, Check, Loader2 } from 'lucide-react'
import type { RpMessage } from '@/types/database'
import { updateRpMessage } from '@/lib/actions/rp'

// Purple/teal, matching the reference messenger screenshot this was
// asked to look like — extended (mod'd) rather than hard-capped at two,
// so a log with a third speaker gets a third color instead of silently
// reusing purple. Fixed hex regardless of site theme (Noir/Sticker) —
// this reads as a screenshot of a chat log, not sitewide UI chrome, the
// same way a character pair's own custom colors aren't tied to the
// site's theme system either. Used as the fallback for any speaker name
// not in NAME_STYLE below, keyed by order of first appearance.
export const SPEAKER_COLORS = ['#C9BFEA', '#8FE3D0', '#F4C9A8', '#A8D4F0']

// Explicit per-character side/color, requested directly for this log's
// two speakers (지오 right, 눌 left with a specific pink) rather than the
// generic order-of-appearance default below. A name not listed here
// still falls back to that default, so a future post with different
// speakers isn't left unstyled.
export const NAME_STYLE: Record<string, { side: 'left' | 'right'; color: string }> = {
  지오: { side: 'right', color: SPEAKER_COLORS[0] },
  눌: { side: 'left', color: '#D2ADB9' },
}

// Wraps each (...) span in <em>, italicizing action/narration asides —
// the RP convention this log already follows — from the dialogue around
// them. Simple non-nesting match; confirmed against this log's actual
// data first (every paren balanced, none nested) rather than assumed.
export function italicizeParens(html: string): string {
  return html.replace(/\([^)]*\)/g, match => `<em>${match}</em>`)
}

// 'bubble' is the default messenger look (avatar + colored speech
// bubble, left/right by speaker). 'script' instead renders the same
// messages as a plain name-left/line-right transcript — the same
// two-column look RpPostcardPreview already uses for its excerpt, just
// applied to the whole log rather than a 1-3 message sample. A single
// global preference (not per-post), same convention as the day-counter
// desk widget's own open/closed choice — see readStoredStyle below.
export type ConversationStyle = 'bubble' | 'script'
const STYLE_STORAGE_KEY = 'rp-conversation-style'

function readStoredStyle(): ConversationStyle {
  if (typeof window === 'undefined') return 'bubble'
  try {
    return localStorage.getItem(STYLE_STORAGE_KEY) === 'script' ? 'script' : 'bubble'
  } catch {
    return 'bubble'
  }
}

// One imported RP log, rendered as a two-speaker message thread —
// avatar, name, and message in a colored speech bubble per direct
// request. Alternates left/right by speaker (first name encountered
// lands left, the next new name lands right, and so on) for any speaker
// not covered by NAME_STYLE, rather than the reference screenshot's own
// single-side layout — that screenshot reads as one character's own
// posts; this data is an actual back-and-forth between two named
// speakers, where left/right is the more legible, standard convention
// for "who's talking" than color alone.
//
// canEdit (editor/admin, same gate as the page itself — see
// archive/rp/[id]/page.tsx's own notFound() check) reveals a per-bubble
// (or, in script style, per-line) edit affordance on hover: clicking it
// swaps that one message's rendered html for a plain textarea (raw
// underlying text, not a rich editor — a couple of messages carry a
// literal <img> tag alongside their dialogue, which shows as editable
// text rather than a live preview while editing, per direct decision)
// with cancel/save controls, persisted via updateRpMessage and mirrored
// into local state immediately rather than waiting on the server
// action's revalidatePath to reach this already-mounted client
// component.
export function RpConversation({ messages, postId, canEdit }: { messages: RpMessage[]; postId: string; canEdit: boolean }) {
  const [localMessages, setLocalMessages] = useState(messages)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Deterministic 'bubble' on first render so server and client agree
  // (same reasoning as excerpt/isTablet in rp-postcard-preview.tsx); the
  // effect below reads the real stored value client-only right after
  // mount. `mounted` also gates the portal below — document doesn't
  // exist during SSR.
  const [layout, setLayout] = useState<ConversationStyle>('bubble')
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setLayout(readStoredStyle())
    setMounted(true)
  }, [])
  useEffect(() => {
    if (!mounted) return
    try { localStorage.setItem(STYLE_STORAGE_KEY, layout) } catch {
      // Storage unavailable — the toggle still works for this visit, just won't be remembered.
    }
  }, [layout, mounted])

  const speakerOrder: string[] = []
  for (const m of localMessages) {
    if (m.type === 'divider') continue
    if (!speakerOrder.includes(m.name)) speakerOrder.push(m.name)
  }

  // Auto-grows the edit textarea to fit its content — these lines can
  // run multiple sentences long, and a fixed single-row box would hide
  // everything past the first line while editing.
  useLayoutEffect(() => {
    const el = editTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft, editingIndex])

  function startEdit(i: number) {
    setEditingIndex(i)
    setDraft(localMessages[i].html)
    setError(null)
  }

  function cancelEdit() {
    setEditingIndex(null)
    setError(null)
  }

  async function saveEdit(i: number) {
    setSaving(true)
    setError(null)
    const { error: saveError } = await updateRpMessage(postId, i, draft)
    setSaving(false)
    if (saveError) { setError(saveError); return }
    setLocalMessages(prev => prev.map((m, idx) => (idx === i ? { ...m, html: draft } : m)))
    setEditingIndex(null)
  }

  return (
    <>
      {/* Portaled onto <body>, not rendered in place — this component
          mounts inside archive/rp/[id]/page.tsx's own animate-fade-up
          div, whose keyframes leave a permanent transform: translateY(0)
          on it even after the animation ends (same issue documented in
          ProfileEditModal's own portal comment). That turns it into the
          containing block for any fixed-position descendant, which would
          trap this button inside that div's box — scrolling right along
          with the log — instead of staying fixed in the viewport like
          the back button and ScrollTimeline beside it. Same
          min-[1020px] gate as ScrollTimeline itself (scroll-timeline.tsx)
          since this toggle sits directly above that rail and has nothing
          to pair with once the rail itself is hidden. */}
      {/* noir-accent-color only while active — this class forces
          color: var(--theme-accent) !important on Noir, which would
          otherwise stomp the inactive text-ink-400/hover:text-ink styling
          below regardless of state (confirmed live: the button read as
          permanently "on" on Noir, no dim/inactive look, exactly the bug
          reported). Conditioning it on layout keeps the active/inactive
          contrast on every theme, not just Default. justify-start (not
          -center) left-aligns the glyph with the tick rail's own
          flush-left lines below it, reported directly as visually
          indented before this. */}
      {mounted && createPortal(
        <button
          type="button"
          onClick={() => setLayout(s => (s === 'script' ? 'bubble' : 'script'))}
          aria-label={layout === 'script' ? 'Switch to bubble style' : 'Switch to script style'}
          aria-pressed={layout === 'script'}
          className={`hidden min-[1020px]:flex fixed left-[2.6%] z-[60] w-8 h-8 items-center justify-start font-display text-base transition-colors ${layout === 'script' ? 'noir-accent-color' : 'text-ink-400 hover:text-ink'}`}
          style={{ top: 'calc(50% - 160px)', color: layout === 'script' ? 'var(--theme-accent)' : undefined }}
        >
          T
        </button>,
        document.body
      )}

      <div className="flex flex-col gap-4">
        {localMessages.map((m, i) => {
          // A section title, not a line of dialogue — a single post that's
          // actually two separate scenes back to back, per direct request
          // ("separate them with a title"), rather than splitting into two
          // posts the way "0차"/"1차" were.
          if (m.type === 'divider') {
            return (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-scroll-300" />
                <span className="text-xs font-medium tracking-[0.15em] uppercase text-ink-400 noir-accent-color">
                  {m.name}
                </span>
                <div className="flex-1 h-px bg-scroll-300" />
              </div>
            )
          }

          const speakerIndex = speakerOrder.indexOf(m.name)
          const nameStyle = NAME_STYLE[m.name]
          const isRight = nameStyle ? nameStyle.side === 'right' : speakerIndex % 2 === 1
          const color = nameStyle ? nameStyle.color : SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length]
          const isEditing = editingIndex === i

          if (layout === 'script') {
            return (
              <div key={i} className="flex items-start gap-3">
                <span className="shrink-0 w-16 text-xs font-semibold tracking-wide pt-2.5" style={{ color }}>
                  {m.name}
                </span>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-end gap-1.5">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                        aria-label="Cancel edit"
                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-ink-400 hover:text-ink noir-accent-color transition-colors disabled:opacity-40"
                      >
                        <X size={14} />
                      </button>
                      <textarea
                        ref={editTextareaRef}
                        autoFocus
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
                        rows={1}
                        className="textarea flex-1 min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(i)}
                        disabled={saving}
                        aria-label="Save message"
                        // Filled with the theme's own point color rather
                        // than a fixed bg-sage green, per direct request —
                        // and the icon color mirrors it with --theme-bg
                        // (not a hardcoded white), since lib/themes.ts
                        // defines pointColor and background as each
                        // theme's own inverse pair (Default: dark accent
                        // on a light page; Noir: near-white accent on a
                        // near-black page) — using --theme-bg as the
                        // icon's color rides that same inversion instead
                        // of needing a separate per-theme contrast color.
                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80 active:scale-[0.98] transition-all disabled:opacity-40"
                        style={{ backgroundColor: 'var(--theme-accent)', color: 'var(--theme-bg)' }}
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      </button>
                    </div>
                  ) : (
                    <div className="relative group/msg">
                      {/* noir-accent-color, not just text-ink — reported
                          directly: script view has no bubble fill behind
                          it (unlike bubble style), so on Noir's near-black
                          page this plain ink text read as barely visible.
                          Swaps to the theme's own point color (--theme-
                          accent) on Noir only; Default keeps text-ink. */}
                      <div
                        className="noir-accent-color text-sm leading-relaxed text-ink whitespace-pre-wrap pt-1 pr-8 [&_img]:mt-2 [&_img]:rounded-lg [&_img]:max-w-full"
                        dangerouslySetInnerHTML={{ __html: italicizeParens(m.html) }}
                      />
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => startEdit(i)}
                          aria-label="Edit message"
                          className="hidden min-[520px]:flex absolute -top-1 right-0 w-6 h-6 rounded-full bg-ink-900 text-scroll-100 items-center justify-center shadow-parchment opacity-0 pointer-events-none group-hover/msg:opacity-100 group-hover/msg:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto transition-opacity"
                        >
                          <Pencil size={11} />
                        </button>
                      )}
                    </div>
                  )}
                  {isEditing && error && <p className="field-error">{error}</p>}
                </div>
              </div>
            )
          }

          return (
            <div key={i} className={`flex items-start gap-2 ${isRight ? 'flex-row-reverse' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- external
                  mastodon.social-hosted avatar, not in next/image's allowed
                  remote patterns (next.config.js only whitelists our own
                  Supabase storage) */}
              <img src={m.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              {/* The 75% cap is a deliberate chat-bubble proportion for
                  normal display, but it left editing cramped — reported
                  directly. flex-1 while editing instead lets this column
                  (and the full-width textarea inside it) claim the entire
                  row's remaining space next to the avatar, rather than
                  staying boxed into the same width a short bubble would
                  use. */}
              <div className={`flex flex-col gap-1 ${isEditing ? 'flex-1 min-w-0' : 'max-w-[75%]'} ${isRight ? 'items-end' : 'items-start'}`}>
                <span className="text-xs font-medium text-ink-400 noir-accent-color px-1">{m.name}</span>

                {isEditing ? (
                  <div className="flex items-end gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      aria-label="Cancel edit"
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-ink-400 hover:text-ink noir-accent-color transition-colors disabled:opacity-40"
                    >
                      <X size={14} />
                    </button>
                    <textarea
                      ref={editTextareaRef}
                      autoFocus
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') cancelEdit() }}
                      rows={1}
                      className="flex-1 min-w-0 rounded-[6px] px-4 py-2.5 text-sm leading-relaxed text-ink whitespace-pre-wrap resize-none focus:outline-none focus:ring-2 focus:ring-ink/20"
                      style={{ backgroundColor: color }}
                    />
                    <button
                      type="button"
                      onClick={() => saveEdit(i)}
                      disabled={saving}
                      aria-label="Save message"
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80 active:scale-[0.98] transition-all disabled:opacity-40"
                      style={{ backgroundColor: 'var(--theme-accent)', color: 'var(--theme-bg)' }}
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                  </div>
                ) : (
                  <div className="relative group/msg">
                    {/* dangerouslySetInnerHTML, not plain text — two messages in
                        the imported log carry an inline image alongside the
                        dialogue text (an actual shared picture, not a typo), and
                        there's no separate field to split that out into; this
                        content is a fixed one-time import authored by us, not
                        live user input rendered back to other users. */}
                    <div
                      className="rounded-[6px] px-4 py-2.5 text-sm leading-relaxed text-ink whitespace-pre-wrap [&_img]:mt-2 [&_img]:rounded-lg [&_img]:max-w-full"
                      style={{ backgroundColor: color }}
                      dangerouslySetInnerHTML={{ __html: italicizeParens(m.html) }}
                    />
                    {canEdit && (
                      // hidden below 520px (this codebase's own mobile
                      // cutoff — see rp-postcard-preview.tsx's matching
                      // breakpoint) — reported directly that inline editing
                      // shouldn't be reachable on a phone-sized screen at
                      // all, not just hidden until tapped.
                      <button
                        type="button"
                        onClick={() => startEdit(i)}
                        aria-label="Edit message"
                        className="hidden min-[520px]:flex absolute -top-2 -right-2 w-6 h-6 rounded-full bg-ink-900 text-scroll-100 items-center justify-center shadow-parchment opacity-0 pointer-events-none group-hover/msg:opacity-100 group-hover/msg:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto transition-opacity"
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                  </div>
                )}

                {isEditing && error && <p className="field-error">{error}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
