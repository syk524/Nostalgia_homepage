'use client'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Copyright } from 'lucide-react'
import { DotMatrixLoader } from '@/components/dot-matrix-loader'
import type { PostPage } from '@/types/database'

// One on-screen reading page — not the same thing as a PostPage row
// (below). A single PostPage can spill across several of these once its
// own body text is too long to fit the reader's fixed height; imageUrl
// (and imageCredit/imageHeight alongside it) only ever appears on the
// FIRST screen split out of a given PostPage (see paginate() below),
// matching a real book — an illustration doesn't repeat on every page the
// surrounding paragraph happens to spill onto, and neither does its
// caption. imageHeight is that image's own real rendered height at the
// column's IMAGE_WIDTH_RATIO width (see loadImageSize below) — computed
// once per page, not a fixed guess, so pagination's own text budget
// reflects the image's actual size instead of a stand-in box.
type Screen = { imageUrl: string | null; imageCredit: string | null; imageHeight: number | null; text: string }

// The image's own box is always this fraction of the column's width (see
// the w-1/2 class below) — used here purely to convert a loaded image's
// natural aspect ratio into the pixel height it'll actually render at,
// so paginate()'s own text budget can reserve exactly that much space
// instead of a fixed guess. No max-height clamp on top of that, on
// direct request — a portrait image is allowed to take up as much of the
// screen's real height as its own aspect ratio implies.
const IMAGE_WIDTH_RATIO = 0.5
// Used only when an image's real dimensions can't be determined (load
// error) — a same-in-spirit fallback to the old fixed-box behavior for
// that one case, not a normal ceiling.
const FALLBACK_IMAGE_HEIGHT = 220
const IMAGE_GAP = 24
// Reserved only when a page's image actually has a credit line — an
// approximation of one 12px caption's own line height plus its small top
// margin, not something measured live.
const CREDIT_HEIGHT = 20
// Extra headroom subtracted from every screen's own height budget, on
// top of the real measured height — without it, pagination fills right
// up to the very last pixel the box can hold, which (line-height
// rounding, the measurer's own sub-pixel differences from the real
// paragraph) read as the last line sitting uncomfortably flush against
// the bottom edge, reported directly as looking "cropped" even though
// nothing was actually clipped.
const BOTTOM_SAFETY_MARGIN = 16
const TEXT_CLASSNAME = 'whitespace-pre-wrap leading-loose text-[15px]'
const TEXT_STYLE: React.CSSProperties = { fontFamily: 'var(--font-kopub-light), Georgia, serif' }

// Binary search over character offset (not a word-by-word linear scan —
// O(log n) measurements per break instead of O(n)) for the longest
// prefix of `text` whose rendered height (in `measurer`, already sized
// to the real column's exact width) stays within `maxHeight`. Snapped
// back to the nearest preceding whitespace afterward so a break never
// lands mid-word.
function findBreak(text: string, measurer: HTMLElement, maxHeight: number): number {
  measurer.textContent = text
  if (measurer.scrollHeight <= maxHeight) return text.length
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2)
    measurer.textContent = text.slice(0, mid)
    if (measurer.scrollHeight <= maxHeight) lo = mid
    else hi = mid - 1
  }
  let cut = lo
  while (cut > 0 && !/\s/.test(text[cut])) cut--
  // A single word/run taller than the box on its own (lo === 0, nothing
  // to snap back to) — fall back to the raw (mid-word) break rather than
  // an infinite loop of never making progress.
  return cut > 0 ? cut : lo
}

// findBreak snaps to the nearest whitespace so a break never lands
// mid-word, but that alone can still leave a short trailing word or two
// as the ENTIRE last visual line of a screen — sitting right against the
// bottom edge with nothing but BOTTOM_SAFETY_MARGIN below it, which reads
// as the text having been cut off rather than deliberately paginated
// (reported directly from a real post). Only matters when the screen
// isn't actually the end of the content — a short last line of a
// paragraph that has genuinely finished is completely normal and left
// alone. Detects the widow by getting one ClientRect per wrapped line via
// a Range over the measurer's own text node (a block element's own
// getClientRects() would just be the single outer box, not per line) and
// comparing the last line's width against the column width; if it's a
// widow, binary-searches the same Range for the character offset where
// that line begins so paginate() can leave it for the next screen.
function widowLineStart(text: string, measurer: HTMLElement): number | null {
  const node = measurer.firstChild
  if (!node) return null
  const full = document.createRange()
  full.selectNodeContents(node)
  const rects = full.getClientRects()
  if (rects.length < 2) return null
  const last = rects[rects.length - 1]
  const columnWidth = measurer.getBoundingClientRect().width
  if (columnWidth === 0 || last.width >= columnWidth * 0.5) return null

  const probe = document.createRange()
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    probe.setStart(node, mid)
    probe.setEnd(node, Math.min(mid + 1, text.length))
    const rect = probe.getClientRects()[0]
    if (rect && Math.abs(rect.top - last.top) < 1) hi = mid
    else lo = mid + 1
  }
  let start = lo
  while (start > 0 && /\s/.test(text[start - 1])) start--
  return start > 0 ? start : null
}

// A post's own images rarely change once published, and the same page
// gets re-paginated on every resize — caching by URL means only the very
// first pagination pass for a given image ever actually loads it.
const imageSizeCache = new Map<string, { width: number; height: number }>()

// naturalWidth/naturalHeight are only available once the browser has
// actually decoded the image, and there's no synchronous way to ask for
// them ahead of that — resolves null on a load error (a dead URL, a since-
// deleted storage object) rather than rejecting, so paginate() below can
// fall back to FALLBACK_IMAGE_HEIGHT instead of the whole pagination pass
// failing over one bad image.
function loadImageSize(url: string): Promise<{ width: number; height: number } | null> {
  const cached = imageSizeCache.get(url)
  if (cached) return Promise.resolve(cached)
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight }
      imageSizeCache.set(url, size)
      resolve(size)
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// Splits every PostPage's own body across as many Screens as its length
// needs, given the real column width/height just measured from the live
// DOM. Pure function of those three inputs — recomputeed (see the effect
// below) whenever any of them changes, not memoized against `pages`
// alone, since the same text needs a different split at a different
// viewport size.
//
// Async — yields to the browser once per screen via a plain setTimeout
// (not requestAnimationFrame — rAF is throttled to zero on a backgrounded/
// hidden tab, and the goal here is just "let the browser catch up," not
// "sync to the next paint") rather than building the whole array in one
// uninterrupted synchronous pass. findBreak's own binary search does
// several forced-reflow scrollHeight reads per screen, and a long page can
// need many screens; running all of that as one blocking block froze the
// main thread for its entire duration, which also stalls the loading dot
// below (its pulse is driven by framer-motion's own rAF loop, which can't
// paint a frame while the thread is busy) — reported directly as the
// loader looking frozen solid instead of animating while a longer novel's
// own pagination runs.
async function paginate(pages: PostPage[], measurer: HTMLElement, width: number, height: number): Promise<Screen[]> {
  measurer.style.width = `${width}px`
  const screens: Screen[] = []
  for (const page of pages) {
    const body = (page.body ?? '').trim()
    // Computed once per page (only the first screen ever shows it) — the
    // image's real height at the column's fixed IMAGE_WIDTH_RATIO width,
    // derived from its own natural aspect ratio rather than a fixed guess.
    let imageHeight: number | null = null
    if (page.image_url) {
      const size = await loadImageSize(page.image_url)
      imageHeight = size ? (width * IMAGE_WIDTH_RATIO) * (size.height / size.width) : FALLBACK_IMAGE_HEIGHT
    }
    if (!body) { screens.push({ imageUrl: page.image_url, imageCredit: page.image_credit, imageHeight, text: '' }); continue }
    let remaining = body
    let first = true
    while (remaining.length > 0) {
      const imageReserve = first && page.image_url ? imageHeight! + IMAGE_GAP + (page.image_credit ? CREDIT_HEIGHT : 0) : 0
      const budget = height - imageReserve - BOTTOM_SAFETY_MARGIN
      const cut = findBreak(remaining, measurer, Math.max(budget, 60))
      let effectiveCut = cut
      let text = (cut >= remaining.length ? remaining : remaining.slice(0, cut)).trimEnd()
      if (cut < remaining.length) {
        measurer.textContent = text
        const widowStart = widowLineStart(text, measurer)
        if (widowStart !== null) {
          text = text.slice(0, widowStart).trimEnd()
          effectiveCut = widowStart
        }
      }
      screens.push({ imageUrl: first ? page.image_url : null, imageCredit: first ? page.image_credit : null, imageHeight: first ? imageHeight : null, text })
      remaining = effectiveCut >= remaining.length ? '' : remaining.slice(effectiveCut).trimStart()
      first = false
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
  return screens
}

// The "novel" post type's reader — post-modal.tsx renders this in place
// of its own image-carousel area when post.post_type === 'novel'. A
// fixed light "page" (bg-scroll-50/text-ink, not the theme-following
// var(--theme-accent) every other piece of this modal uses) rather than
// something that goes near-white-on-white on Noir/Illust — like a real
// e-reader, the page itself stays a consistent light surface regardless
// of the app's own theme, since that's what actually keeps a full
// paragraph of body text legible.
//
// h-[65vh] on the card (below) — a real fixed height, not "however tall
// the content is" — is what makes auto-pagination meaningful at all: an
// editor writing a page's body text no longer has to manually decide
// where to break it into separate pages just to keep this pane from
// scrolling, per direct request. Splitting happens purely from the
// actually-rendered column's own width/height (paginate() above), so it
// reflows correctly across a resize instead of assuming one fixed
// viewport width.
export function NovelReader({ pages: rawPages }: { pages: PostPage[] }) {
  const pages = [...rawPages].sort((a, b) => a.position - b.position)
  const contentRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [screens, setScreens] = useState<Screen[] | null>(null)
  const [screenIndex, setScreenIndex] = useState(0)

  useEffect(() => {
    const content = contentRef.current
    const measurer = measureRef.current
    if (!content || !measurer) return

    // paginate() is now async (see its own comment on why) — a rapid
    // resize can fire this again before an earlier call's own awaited
    // setTimeout chain has finished, and without this token a slower,
    // now-stale call could still land after a newer one and overwrite it
    // with outdated screens. Only the call matching the
    // latest-issued token is allowed to actually setScreens.
    let latestToken = 0

    async function recompute() {
      const token = ++latestToken
      const width = content!.clientWidth
      const height = content!.clientHeight
      if (width === 0 || height === 0) return
      const next = await paginate(pages, measurer!, width, height)
      if (token !== latestToken) return
      setScreens(next)
      // A resize can leave the current position past the new, possibly
      // shorter, screen count — clamped, not reset to 0, so a reflow
      // (e.g. rotating a tablet) keeps you roughly where you were
      // instead of always bouncing back to the very start.
      setScreenIndex(i => Math.min(i, Math.max(0, next.length - 1)))
    }

    recompute()
    // ResizeObserver, not a window resize listener — this pane's own
    // width can change independently of the viewport (e.g. the metadata
    // sidebar's content pushing it, or the 1020px mobile/desktop layout
    // switch), neither of which fires a window resize event on its own.
    const observer = new ResizeObserver(() => { recompute() })
    observer.observe(content)
    return () => { latestToken = -1; observer.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPages])

  const screen = screens?.[screenIndex]
  const total = screens?.length ?? 0
  const hasPrev = screenIndex > 0
  const hasNext = screenIndex < total - 1

  return (
    <div className="relative overflow-hidden shrink-0 min-[1020px]:flex-1 min-[1020px]:min-h-0 flex items-center justify-center p-6 min-[1020px]:p-12">
      {/* A flat black scrim behind the reading card, on by default
          regardless of theme — per direct request. Unlike an image
          post's own backdrop (its blurred first image, dimmed to 70%
          opacity), a novel post has no obvious "hero image" to blur into
          one, and without anything here at all this pane just showed
          whatever sits behind the modal (Illust's own crisp landing
          illustration, IllustPageBg, straight through) uncomfortably
          bright and busy next to the reading card, reported directly.
          Needs the reading card below to be `relative` (a positioned
          element, not just a plain block) — this overlay is also
          `absolute` (positioned), and a positioned sibling always paints
          above an unpositioned one regardless of DOM order; both being
          positioned lets DOM order decide instead, which puts the card
          on top like it visually needs to be. */}
      <div className="absolute inset-0 bg-black/80" aria-hidden="true" />
      <div className="relative w-full max-w-xl h-[65vh] flex flex-col bg-scroll-50 rounded-2xl shadow-2xl border border-scroll-300 overflow-hidden">
        {/* Padding lives on this outer div only — contentRef (below) sits
            entirely inside it with none of its own, so its clientWidth/
            clientHeight (what paginate() measures against) reads as the
            real available space for the image+text column, not that
            space plus this padding on top. Measuring the padded div
            itself here originally over-budgeted height AND width by
            2×padding in each dimension, letting pagination allow more
            text than the visible box could actually hold — confirmed
            directly (scrollHeight > clientHeight on the real content). */}
        <div className="flex-1 min-h-0 p-6 min-[1020px]:p-10 overflow-hidden flex flex-col">
          <div ref={contentRef} className="flex-1 min-h-0 flex flex-col gap-6 overflow-hidden">
            {/* Off-screen, not display:none — a hidden element can't be
                measured (scrollHeight reads 0), but position:fixed way
                off the left edge never affects layout/scroll size while
                still rendering (and being measurable) normally. Same
                className/style as the real paragraph below so wrapping
                (and therefore height) matches exactly once its own width
                is set to the real column's width in paginate() above. */}
            <div ref={measureRef} aria-hidden="true" className={`${TEXT_CLASSNAME} fixed pointer-events-none`} style={{ ...TEXT_STYLE, left: -99999, top: 0 }} />
            {/* screens starts null until the very first recompute() (needs
                contentRef's real, laid-out clientWidth/clientHeight, so it
                can't run synchronously on the initial render) — without
                this, that window showed a blank text column for a beat,
                reported directly. Only ever true pre-first-computation: a
                resize-triggered recompute() replaces the array outright,
                it never resets to null, so this can't reappear once a
                post's pages have paginated once. busyCursor={false} since
                this is a small loading state inside otherwise-interactive
                UI (the reader's own prev/next controls, the rest of the
                modal), not the whole page being busy. */}
            {screens === null && (
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <DotMatrixLoader size={24} color="#8a8782" busyCursor={false} />
              </div>
            )}
            {screen?.imageUrl && (
              <div className="w-full shrink-0" style={{ height: (screen.imageHeight ?? FALLBACK_IMAGE_HEIGHT) + (screen.imageCredit ? CREDIT_HEIGHT : 0) }}>
                {/* w-1/2 (not w-full/max-w) — the image's own width is
                    always exactly half the column by default, per direct
                    request. Height comes from screen.imageHeight — the
                    image's own real rendered height at that width (see
                    paginate()'s own loadImageSize call), not a fixed cap —
                    so a portrait image can render as tall as its actual
                    aspect ratio implies, per direct request. object-contain
                    stays as a safety net for the rare case its dimensions
                    couldn't be measured (FALLBACK_IMAGE_HEIGHT, a guess).
                    mx-auto keeps it centered under the same width the
                    credit caption below centers against. */}
                <div className="w-1/2 mx-auto rounded-lg overflow-hidden" style={{ height: screen.imageHeight ?? FALLBACK_IMAGE_HEIGHT }}>
                  <img src={screen.imageUrl} alt="" className="w-full h-full object-contain" />
                </div>
                {screen.imageCredit && (
                  <p className="flex items-center justify-center gap-1 mt-1 text-[12px] text-ink-400">
                    <Copyright size={11} className="shrink-0" />
                    {screen.imageCredit}
                  </p>
                )}
              </div>
            )}
            {screen && (
              <p className={`${TEXT_CLASSNAME} text-ink`} style={TEXT_STYLE}>
                {screen.text}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 px-6 min-[1020px]:px-10 pb-5 pt-6 border-t border-scroll-300 space-y-3">
          <div className="h-1 rounded-full bg-scroll-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-300"
              style={{ width: total ? `${((screenIndex + 1) / total) * 100}%` : '0%' }}
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setScreenIndex(i => Math.max(0, i - 1))}
              disabled={!hasPrev}
              aria-label="Previous page"
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors disabled:opacity-30 ${hasPrev ? 'text-ink-400 hover:text-ink hover:bg-[#EFEFEF]' : 'text-scroll-300 cursor-default'}`}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-mono text-ink-400">{total ? screenIndex + 1 : 0} / {total}</span>
            <button
              type="button"
              onClick={() => setScreenIndex(i => Math.min(total - 1, i + 1))}
              disabled={!hasNext}
              aria-label="Next page"
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors disabled:opacity-30 ${hasNext ? 'text-ink-400 hover:text-ink hover:bg-[#EFEFEF]' : 'text-scroll-300 cursor-default'}`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
