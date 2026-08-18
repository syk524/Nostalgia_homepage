-- Pair detail pages currently live at the pair's random uuid
-- (/profile/[id]) — this gives them a readable path derived from the
-- title instead (/profile/[slug]), regenerated from the title on every
-- save so the URL always tracks the current display name, with a
-- numeric suffix (-2, -3, …) on collision. Nullable for the backfill
-- below, then locked down.
alter table public.character_pairs add column slug text;

update public.character_pairs set slug =
  trim(both '-' from regexp_replace(lower(trim(title)), '[^[:alnum:]]+', '-', 'g'))
where slug is null;

alter table public.character_pairs alter column slug set not null;
create unique index character_pairs_slug_idx on public.character_pairs (slug);
