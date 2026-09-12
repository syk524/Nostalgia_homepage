-- Optional, separate image for the pair-list grid thumbnail — per direct
-- request, an editor can now upload a different image just for the
-- thumbnail instead of always reusing pair_image_url there. Nullable and
-- defaulting to null: existing rows (and any new profile that never
-- checks the "use a separate thumbnail image" box) keep the current
-- behavior of falling back to pair_image_url, handled at read time in
-- character-pair-grid.tsx/get_public_pair_grid rather than here.
alter table public.pair_profiles add column thumbnail_image_url text;
