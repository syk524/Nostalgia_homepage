-- Each timeline entry can now carry its own image, shown above its
-- subtitle/title on the pair profile page — reported directly.
alter table public.timeline_entries
  add column image_url text;
