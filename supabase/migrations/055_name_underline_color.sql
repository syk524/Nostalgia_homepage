-- The catchphrase/name divider line was a fixed bg-white/60 — this
-- makes its color user-set per character, same convention as
-- name_color/quote_color/etc. Default '#ffffff' matches the line's
-- previous fixed white (opacity is no longer applied — a flat color,
-- like every other <field>_color column here, not a color+opacity
-- pair). The divider itself moves from above the name to below it in
-- character-pair-hero.tsx/character-pair-detail.tsx — a component
-- change, not a schema one.
alter table public.profile_characters
  add column name_underline_color text not null default '#ffffff';
