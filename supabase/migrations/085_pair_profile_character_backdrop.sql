-- An optional image layered between the profile's full-bleed background
-- (background_url, blurred, full viewport) and the character image
-- itself (pair_image_url) — sits directly behind the character art,
-- centered on it, capped to its own box (see CharacterPairHero's own
-- render logic for the sizing rule). Nullable, no default, so every
-- existing profile renders unchanged.
alter table public.pair_profiles
  add column character_backdrop_url text;
