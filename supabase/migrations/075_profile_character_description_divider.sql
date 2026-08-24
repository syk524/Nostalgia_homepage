-- A small (rendered at 32x32) image shown once, centered, between a
-- character's description sections — purely decorative, optional, and
-- independent per character (each of a profile's two characters can
-- use its own image or none). Nullable with no default so every
-- existing character renders unchanged until an editor opts in.
alter table public.profile_characters
  add column description_divider_url text;
