'use client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { DeletePostButton } from '@/app/(main)/gallery/[id]/delete-button'
import { getLastListView } from '@/lib/list-view-tracker'
import { fetchPostDetail } from '@/lib/actions/gallery'
import { useTheme } from '@/components/theme-provider'
import { NoirFloatingParticles } from '@/components/noir-floating-particles'
import type { Post, Profile, PostImage, Category } from '@/types/database'

type FullPost = Post & { author: Profile; images: PostImage[]; category: Category }

export function PostModal({
  post: initialPost, canEdit: initialCanEdit, prevId: initialPrevId, nextId: initialNextId,
}: {
  post: FullPost
  canEdit: boolean
  prevId?: string | null
  nextId?: string | null
}) {
  const router = useRouter()
  const { theme } = useTheme()
  const [closing, setClosing] = useState(false)
  // Prev/next used to be plain <Link>s — a real Next.js navigation to a
  // new /gallery/[id]. That's an intercepted parallel route
  // (@modal/(.)[id]), and confirmed directly (a marker attribute set on
  // the root element, gone after clicking prev/next): Next fully remounts
  // this whole component on every dynamic-segment change, which is what
  // made browsing feel like "the whole thing refreshing" rather than a
  // smooth content swap. Holding the current post in local state instead,
  // fetched client-side via fetchPostDetail (see lib/actions/gallery.ts),
  // keeps this one component instance mounted across prev/next — only the
  // key={post.id} content wrappers below remount now, which is what
  // actually lets their own animate-fade-up entrance mean something.
  const [current, setCurrent] = useState({ post: initialPost, canEdit: initialCanEdit, prevId: initialPrevId, nextId: initialNextId })
  const [navigating, setNavigating] = useState(false)
  const { post, canEdit, prevId, nextId } = current
  const images = [...(post.images ?? [])].sort((a, b) => a.position - b.position)
  const backdrop = images[0]?.image_url

  // Bypasses Next's router entirely (a plain history.replaceState, not
  // router.replace) — router.replace would re-trigger the exact same
  // full-remount navigation this function exists to avoid. The one real
  // tradeoff: Next's own usePathname() (nav.tsx's category highlighting)
  // goes stale, still reporting the URL from before this call. Checked
  // directly — nav.tsx only tests the general route SHAPE
  // (/^\/gallery\/(?!new$)[^/]+$/, "some post detail page", not which
  // post), which a stale-but-still-/gallery/{some-other-id} pathname
  // still matches identically, so this doesn't change what it highlights.
  // replaceState (not pushState) to match the old Link replace={true} —
  // browsing prev/next shouldn't pile up its own history entries.
  async function goTo(id: string | null | undefined) {
    if (!id || navigating) return
    setNavigating(true)
    const result = await fetchPostDetail(id)
    setNavigating(false)
    // Falls back to a real navigation on error (e.g. the post was deleted
    // between clicks) — that rare path can afford to be a full page
    // transition; it doesn't need to be smooth, it needs to be correct
    // (a real 404, not a silently stuck modal).
    if (!('post' in result) || !result.post) { router.push(`/gallery/${id}`); return }
    setCurrent({ post: result.post, canEdit: result.canEdit, prevId: result.prevId, nextId: result.nextId })
    window.history.replaceState(null, '', `/gallery/${id}`)
  }

  // Always jump straight to the actual gallery list the user last saw —
  // router.back() depends on exactly how this popover was reached (edit →
  // cancel, edit → save, browsing prev/next), and those don't all put the
  // list one step behind in history, so back() could land on a stale form
  // page or a different post instead.
  //
  // Closing used to be window.location.href (a full reload) — pushing to a
  // URL that matches the @children slot's existing path doesn't reconcile
  // the @modal parallel slot in this Next.js version (confirmed directly:
  // the URL bar updates but the modal stays rendered on top). A hard
  // reload sidestepped that by tearing down the whole page, but
  // SoundPlayer lives in the root layout too, so every close silently
  // stopped and restarted whatever was playing. Since we're not relying on
  // Next to clear the slot anyway, we don't need it to: `closing` hides
  // this component immediately via ordinary component state (`return
  // null` below), which is instant and touches nothing outside this
  // component — the audio element two levels up in the tree is never
  // touched — router.push still runs alongside it purely so the URL bar,
  // browser history, and anything reading it (Nav's category
  // highlighting) end up correct, but nothing here depends on that push
  // actually doing the unmounting.
  function close() {
    setClosing(true)
    router.push(getLastListView())
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft' && prevId) goTo(prevId)
      if (e.key === 'ArrowRight' && nextId) goTo(nextId)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [prevId, nextId, navigating])

  // This modal sits on top of the still-mounted /gallery grid page (a
  // parallel-route intercept, not a real navigation away from it), and
  // that page scrolls at the real body level with nothing else locking it.
  // A wheel/trackpad scroll over a pane here that's shorter than its own
  // box (e.g. a short-metadata post) had nowhere to go, so the browser's
  // normal scroll-chaining walked past this modal's own overflow-hidden
  // root and scrolled the hidden gallery grid behind it instead — reported
  // directly as "scroll follows the gallery list, not the open photo."
  // Locking body scroll removes that fallback target entirely. Keyed on
  // `closing`, not a mount-only empty array — close() (above) never
  // actually unmounts this component, it just flips `closing` and renders
  // null (see that function's own comment on why), so a plain
  // unmount-cleanup would never run and this lock would stay stuck on
  // every /gallery visit after the first post view. Re-running the effect
  // when `closing` flips to true fires last render's cleanup (restoring
  // the original value) and then bails out before relocking.
  useEffect(() => {
    if (closing) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [closing])

  // After every hook above — an early return before them would call a
  // different number of hooks between the open and closing renders,
  // which is exactly the "Rendered fewer hooks than expected" crash
  // this used to trip.
  if (closing) return null

  return (
    // Solid, not transparent — this modal is a true parallel-route
    // intercept (@modal/(.)[id]) sitting on top of the real, still-mounted
    // gallery grid page (or, right after publishing, the create form), so
    // a transparent root let that content show through and clip messily
    // against the modal edge and Nav's category links, reported directly.
    // var(--theme-bg), not a fixed bg-scroll-100 — also reported directly:
    // a fixed light fill here read as a stray light panel against Noir's
    // near-black page, even though it did stop the grid/form leak. Tracking
    // the site's own background gets both at once — solid either way,
    // correctly dark on Noir instead of a mismatched light patch.
    // The old pl-[calc(2.6vw+159px)] gutter reservation moved into its own
    // flex child below (the "category gutter" div) instead of living here
    // as padding — it needs its own box now to host the particle layer.
    // Below 1020px, the whole modal is one scrolling page (root itself
    // overflow-y-auto, sidebar and image area both in normal flow) instead
    // of the sidebar and image each owning a separate clipped scroll pane —
    // that split used to pin the blurred backdrop to a fixed-height box
    // with the actual image scrolling inside it, leaving the backdrop
    // visibly shorter than the image content. Letting the image container
    // size to its natural (unclamped) height instead means the backdrop's
    // absolute inset-0/h-full resolves against that real content height,
    // so it now extends the full length of the image instead of cutting
    // off partway down. Desktop (min-[1020px]:) keeps the original
    // independently-scrolling side-by-side panes, unchanged.
    <div
      className="fixed inset-0 z-50 flex flex-col min-[1020px]:flex-row overflow-y-auto min-[1020px]:overflow-hidden animate-fade-up"
      style={{ backgroundColor: 'var(--theme-bg)' }}
    >
      {/* Category gutter — clears Nav's floating category links (left-2.6%,
          ~99px wide at their widest label) with a steady 60px gap — see
          gallery/page.tsx for why vw, not %. Nav is mounted once at the
          root layout, sits above this modal's z-50 via its own z-[60], and
          never remounts between posts, so it's the same nav everywhere
          rather than something owned by this modal. This div carries no
          background of its own — it just sits on top of the root's own
          solid fill above — so on Noir the particle canvas draws directly
          onto that black, visible behind Nav's floating links; on Default
          it's the same plain bg-scroll-100-colored gutter as before, now
          with an explicit box instead of bare padding. Hidden below
          1020px since nothing (gutter or Nav's rail) occupies that space
          at that breakpoint either. */}
      <div aria-hidden="true" className="hidden min-[1020px]:block shrink-0 w-[calc(2.6vw+159px)] relative overflow-hidden">
        {theme === 'noir' && <NoirFloatingParticles />}
      </div>
      {/* Metadata sidebar — fixed width on desktop, unless there are no
          images to show, in which case it takes the full remaining width
          instead of leaving an empty placeholder pane next to it. 1020px,
          this site's own mobile/desktop breakpoint (not Tailwind's default
          sm:), matching gallery/page.tsx and nav.tsx's own category rail.
          No max-h/overflow-y-auto of its own below 1020px — it's part of
          the single root-level scroll there instead (see comment above).
          Stays solidly opaque on every theme, including Noir — the
          particle effect belongs in the gutter above, not behind this
          panel's own readable text, reported directly. */}
      <div className={`${images.length ? 'w-full min-[1020px]:w-96 shrink-0' : 'flex-1'} min-[1020px]:max-h-full min-[1020px]:h-full min-[1020px]:overflow-y-auto border-b min-[1020px]:border-b-0 min-[1020px]:border-r border-scroll-300 noir-border bg-scroll-50 noir-panel-bg p-6 flex flex-col gap-4`}>
        {/* Same rounded (not rounded-full) + hover:bg-[#EFEFEF] treatment
            as the link bar's own collapse/expand toggle
            (links-archive-view.tsx's "Hide/Show link list" buttons) —
            reported directly. Disabled prev/next (no prevId/nextId) keeps
            its own separate text-scroll-300/cursor-default state,
            unrelated to this hover restyle. */}
        <div className="flex items-center gap-1 -ml-2">
          <button
            onClick={close}
            aria-label="Close"
            className="w-8 h-8 rounded text-ink-400 hover:text-ink hover:bg-[#EFEFEF] noir-row-hover flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
          {/* Plain buttons now, not <Link>s — see goTo's own comment
              above for why (a real Link navigation is exactly the
              full-remount this whole change avoids). disabled (not just
              a style/cursor swap) blocks both click and keyboard
              activation outright when there's nowhere to go. */}
          <button
            type="button"
            onClick={() => goTo(prevId)}
            disabled={!prevId || navigating}
            aria-label="Previous post"
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors disabled:opacity-40 ${prevId ? 'text-ink-400 hover:text-ink hover:bg-[#EFEFEF] noir-row-hover' : 'text-scroll-300 cursor-default'}`}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => goTo(nextId)}
            disabled={!nextId || navigating}
            aria-label="Next post"
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors disabled:opacity-40 ${nextId ? 'text-ink-400 hover:text-ink hover:bg-[#EFEFEF] noir-row-hover' : 'text-scroll-300 cursor-default'}`}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Keyed on post.id, separately from the nav row above and the
            edit/delete row below — reported directly, so clicking prev/
            next re-triggers this block's own animate-fade-up entrance
            (a smooth swap) without remounting the buttons around it or
            depending on a full route-level navigation transition. */}
        <div key={post.id} className="flex flex-col gap-4 animate-fade-up">
          <div className="space-y-2 pt-2">
            <p className="text-xs font-mono uppercase tracking-wide" style={{ color: 'color-mix(in srgb, var(--theme-accent) 60%, transparent)' }}>Gallery</p>
            <h1 className="text-2xl leading-tight" style={{ color: 'var(--theme-accent)' }}>{post.title}</h1>
          </div>

          <p className="text-xs font-mono" style={{ color: 'color-mix(in srgb, var(--theme-accent) 60%, transparent)' }}>{formatDate(post.created_at)}{post.is_edited ? ' · edited' : ''}</p>

          <div className="space-y-3 text-sm pt-4 mt-2 border-t border-scroll-300">
            <div className="flex justify-between items-baseline gap-4">
              <span className="font-mono text-xs uppercase tracking-wide" style={{ color: 'color-mix(in srgb, var(--theme-accent) 60%, transparent)' }}>Author</span>
              <span className="text-right" style={{ color: 'var(--theme-accent)' }}>{post.author?.display_name || post.author?.username}</span>
            </div>
            {post.category && (
              <div className="flex justify-between items-baseline gap-4">
                <span className="font-mono text-xs uppercase tracking-wide noir-accent-color" style={{ color: 'color-mix(in srgb, var(--theme-accent) 60%, transparent)' }}>Category</span>
                <span className="tag">{post.category.name}</span>
              </div>
            )}
          </div>

          {post.body && (
            <p className="whitespace-pre-wrap leading-relaxed text-sm pt-4 mt-2 border-t border-scroll-300" style={{ color: 'var(--theme-accent)' }}>{post.body}</p>
          )}
        </div>

        {canEdit && (
          <div className="flex gap-2 pt-4 mt-auto border-t border-scroll-300">
            <a href={`/gallery/${post.id}/edit`} className="btn-ghost noir-accent-color noir-edit-border">Edit</a>
            <DeletePostButton postId={post.id} />
          </div>
        )}
      </div>

      {/* Image area — blurred, scaled backdrop fills the dead space; the
          actual image(s) sit framed on top, scrolling as a stack for
          multi-image posts. Skipped entirely when there's nothing to show,
          so the metadata sidebar above takes the full width instead. Below
          1020px this container's height is just its natural content height
          (no flex-1/min-h-0 clamp), so the absolute backdrop's h-full —
          which resolves against that real height — extends the full
          length of the image stack instead of being clipped to a fixed
          viewport-height box; see the root div's own comment above.
          overflow-hidden stays unconditional (not min-[1020px]:-only) even
          though the height clamp is desktop-only — blur-3xl on the
          backdrop paints past its own element box (like a spread
          box-shadow), and without a clip here that blur bled up past this
          container's own top edge into the metadata sidebar above it,
          reported directly. Clipping to the container's own (now
          content-matched) bounds keeps the blur's visible edge exactly at
          the image content's own top, not the sidebar. shrink-0 (base,
          unconditional) guards against a flexbox-specific side effect of
          that same overflow-hidden: a flex item's automatic min-height
          normally floors at its content's own size, but overflow other
          than visible switches that floor to 0 — which let this container
          get squeezed down to whatever leftover space remained in the
          fixed-height root flex column below 1020px, cropping the image
          instead of the root scrolling past it. min-[1020px]:flex-1
          overrides shrink-0 back on at that breakpoint, restoring the
          original bounded/clipped desktop pane. */}
      {images.length > 0 && (
        // key={post.id} — same reasoning as the metadata block above:
        // remounts just this pane's own content on prev/next so its
        // animate-fade-up entrance replays as a smooth swap, instead of
        // the images instantly snapping to the new post's images (they'd
        // already remount individually via their own key={img.id}, since
        // a new post's image ids necessarily differ — but with no
        // transition on that swap, it happened as a hard cut).
        <div key={post.id} className="relative overflow-hidden shrink-0 min-[1020px]:flex-1 min-[1020px]:min-h-0 animate-fade-up">
          {/* Transparent, not bg-scroll-200 — reported directly. Whatever
              shows through (the blurred backdrop img still covers most of
              it at 70% opacity once loaded; before that, or wherever it
              doesn't reach, this is just the page behind the modal now). */}
          {backdrop && (
            <Image
              src={backdrop}
              alt=""
              aria-hidden="true"
              fill
              sizes="100vw"
              className="object-cover blur-3xl scale-110 opacity-70"
            />
          )}
          {/* The images themselves stay plain <img> — their box is sized
              to CONTENT (max-w-full w-auto, capped by max-h), not the
              other way around: next/image's fill mode needs a
              pre-determined box to fill, and its non-fill mode needs a
              real width/height, neither of which we have per-image
              (no stored dimensions), so there's nothing to hand it that
              wouldn't distort or mis-size the box. */}
          {/* Each image is capped well under full height when there's more
              than one, so the next image's top edge peeks in at the bottom
              of the viewport as a scroll affordance instead of being fully
              hidden below the fold. The first image gets its own min-h-full
              wrapper so it sits vertically centered in the pane on load —
              later images (if any) just stack normally beneath it, not
              individually centered. min-h-full/centering is a 1020px+-only
              effect now, since it depends on the parent's own h-full, which
              is desktop-only below. */}
          <div className="relative min-[1020px]:h-full min-[1020px]:overflow-y-auto flex flex-col items-center gap-2 p-6 min-[1020px]:p-12">
            {images.map((img, i) => (
              i === 0 ? (
                <div key={img.id} className="min-h-full w-full flex items-center justify-center shrink-0">
                  <img
                    src={img.image_url}
                    alt=""
                    className={`max-w-full w-auto rounded-lg shadow-2xl ${images.length > 1 ? 'max-h-[65vh]' : 'max-h-[80vh]'}`}
                  />
                </div>
              ) : (
                <img
                  key={img.id}
                  src={img.image_url}
                  alt=""
                  className="max-w-full w-auto rounded-lg shadow-2xl shrink-0 max-h-[65vh]"
                />
              )
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
