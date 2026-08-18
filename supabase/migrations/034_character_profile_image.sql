-- Profile picture used by the timeline's per-character thought avatar
-- (previously just an initial-letter circle) — nullable, falls back to
-- initials when unset.
alter table public.characters add column profile_image_url text;
