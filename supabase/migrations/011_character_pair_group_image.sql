-- A dedicated "both characters together" image, distinct from cover_url
-- (archive-list thumbnail) and background_url (page background substitute).
-- Shown prominently on the pair's detail page.
alter table public.character_pairs add column pair_image_url text;
