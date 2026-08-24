-- An optional image shown above or below a character's caption
-- (catchphrase/name/quote/keywords, see character-pair-hero.tsx) — not
-- the description divider (description_divider_url, migration 075),
-- which sits inside the description sections lower on the page.
-- Nullable/defaulted so every existing character renders unchanged.
alter table public.profile_characters
  add column caption_image_url text,
  add column caption_image_position text not null default 'top'
    check (caption_image_position in ('top', 'bottom'));
