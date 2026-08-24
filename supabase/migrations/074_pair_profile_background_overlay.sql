-- A flat color layer over the background image, independent of blur
-- strength — lets an editor darken/tint a busy background without also
-- softening it. Opacity is 0-100 (same percent-strength convention as
-- background_blur), defaulting to 0 (no overlay) so every existing
-- profile renders unchanged until an editor opts in.
alter table public.pair_profiles
  add column background_overlay_color text not null default '#000000',
  add column background_overlay_opacity integer not null default 0 check (background_overlay_opacity between 0 and 100);
