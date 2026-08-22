-- Backfills `class="trpg-avatar"` onto every avatar <img> saved before
-- trpg-session-editor.tsx's paste transform started tagging them itself.
-- globals.css used to treat every <img> as a small avatar chip by
-- default and had scene-divider illustrations opt OUT via a class; that
-- got flipped the other way (every <img> now renders at its own real
-- size by default, and the avatar opts IN via `trpg-avatar`) so newly
-- added images don't inherit the tiny-chip treatment by accident. Any
-- session saved before that flip has avatar <img>s with no class at
-- all, so without this backfill they'd silently fall into the new
-- default instead — rendering full-size and block-level, with a
-- `my-3` gap above/below, instead of their small inline chip. Matched on
-- Roll20's own exact avatar inline style (box-sizing/border/vertical-
-- align/max-width:28px/height:auto/max-height:28px, captured verbatim by
-- the Image extension) rather than position or adjacency — that string
-- is unique to a real Roll20 avatar and won't false-positive on a scene-
-- divider illustration or any other embedded image.
update public.trpg_sessions
set body = regexp_replace(
  body,
  '<img ([^>]*max-width: 28px; height: auto; max-height: 28px;[^>]*)>',
  '<img class="trpg-avatar" \1>',
  'g'
)
where body like '%max-width: 28px; height: auto; max-height: 28px;%';
