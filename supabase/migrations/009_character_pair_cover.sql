-- Each pair gets its own cover image (used as the archive-list thumbnail),
-- distinct from the full-page background and either character's portrait.
alter table public.character_pairs add column cover_url text;
