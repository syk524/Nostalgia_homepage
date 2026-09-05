import type { RpMessage } from '@/types/database'

// Purple/teal, matching the reference messenger screenshot this was
// asked to look like — extended (mod'd) rather than hard-capped at two,
// so a log with a third speaker gets a third color instead of silently
// reusing purple. Fixed hex regardless of site theme (Noir/Sticker) —
// this reads as a screenshot of a chat log, not sitewide UI chrome, the
// same way a character pair's own custom colors aren't tied to the
// site's theme system either. Used as the fallback for any speaker name
// not in NAME_STYLE below, keyed by order of first appearance.
const SPEAKER_COLORS = ['#C9BFEA', '#8FE3D0', '#F4C9A8', '#A8D4F0']

// Explicit per-character side/color, requested directly for this log's
// two speakers (지오 right, 눌 left with a specific pink) rather than the
// generic order-of-appearance default below. A name not listed here
// still falls back to that default, so a future post with different
// speakers isn't left unstyled.
const NAME_STYLE: Record<string, { side: 'left' | 'right'; color: string }> = {
  지오: { side: 'right', color: SPEAKER_COLORS[0] },
  눌: { side: 'left', color: '#D2ADB9' },
}

// Wraps each (...) span in <em>, italicizing action/narration asides —
// the RP convention this log already follows — from the dialogue around
// them. Simple non-nesting match; confirmed against this log's actual
// data first (every paren balanced, none nested) rather than assumed.
function italicizeParens(html: string): string {
  return html.replace(/\([^)]*\)/g, match => `<em>${match}</em>`)
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
export function RpConversation({ messages }: { messages: RpMessage[] }) {
  const speakerOrder: string[] = []
  for (const m of messages) {
    if (!speakerOrder.includes(m.name)) speakerOrder.push(m.name)
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((m, i) => {
        const speakerIndex = speakerOrder.indexOf(m.name)
        const style = NAME_STYLE[m.name]
        const isRight = style ? style.side === 'right' : speakerIndex % 2 === 1
        const color = style ? style.color : SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length]
        return (
          <div key={i} className={`flex items-start gap-2 ${isRight ? 'flex-row-reverse' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- external
                mastodon.social-hosted avatar, not in next/image's allowed
                remote patterns (next.config.js only whitelists our own
                Supabase storage) */}
            <img src={m.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
            <div className={`flex flex-col gap-1 max-w-[75%] ${isRight ? 'items-end' : 'items-start'}`}>
              <span className="text-xs font-medium text-ink-400 noir-accent-color px-1">{m.name}</span>
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
