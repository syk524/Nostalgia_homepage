-- User-adjustable width (px) for the caption image added in migration
-- 077 — height still follows the source's own aspect ratio, only width
-- is a knob. 50px floor, 650px ceiling matches CharacterCaption's own
-- fixed max-w-[650px] (character-pair-hero.tsx) — the image was never
-- meant to exceed the caption column it sits in. Defaults to 320, the
-- fixed value it rendered at before this was configurable.
alter table public.profile_characters
  add column caption_image_size integer not null default 320
    check (caption_image_size between 50 and 650);
