-- Per-character portraits are dropped in favor of the pair's single shared
-- cover image (added in 009) — no data exists in this column yet.
alter table public.characters drop column image_url;
