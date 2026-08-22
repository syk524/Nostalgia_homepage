-- Session detail pages currently live at the row's random uuid
-- (/archive/trpg/[id]) — this gives them a readable path derived from the
-- title instead (/archive/trpg/[slug]), regenerated from the title on
-- every save so the URL always tracks the current display name, with a
-- numeric suffix (-2, -3, …) on collision — same shape as
-- character_pairs.slug (032_character_pair_slug.sql). Nullable for the
-- backfill below, then locked down.
--
-- The one existing session's title ("미식예찬") is all-Hangul, so the naive
-- ASCII-strip regexp_replace character_pairs' own backfill used would
-- produce an empty string — 'misigyechan' below is the actual output of
-- slug.ts's romanizeHangul() run against that title, not a guess.
alter table public.trpg_sessions add column slug text;

update public.trpg_sessions set slug = 'misigyechan'
where slug is null and title = '미식예찬';

alter table public.trpg_sessions alter column slug set not null;
create unique index trpg_sessions_slug_idx on public.trpg_sessions (slug);
