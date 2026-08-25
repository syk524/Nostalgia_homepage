-- The fictional setting/AU a profile belongs to, shown only on the pair
-- grid card's thumbnail (top-left of its background image) — never on
-- the pair's own detail page. Plain text, no per-profile font/color
-- customization, since the grid thumbnail already renders its credit
-- (illustration_source) in one fixed style regardless of what's picked
-- for the detail page, and this follows that same fixed style.
alter table public.pair_profiles
  add column world text;
