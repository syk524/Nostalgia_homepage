-- RP post detail pages currently live at the row's random uuid
-- (/archive/rp/[id]) — this gives them a readable path derived from the
-- title instead (/archive/rp/[slug]), same shape as trpg_sessions.slug
-- (060_trpg_session_slug.sql) and character_pairs.slug
-- (032_character_pair_slug.sql). Nullable for the backfill below, then
-- locked down.
--
-- Unlike trpg_sessions/character_pairs, there's no create/edit form for
-- rp_posts at all (097's own comment: authored/imported directly, as one
-- unit) — so there's no uniqueSlug()-on-save regeneration path here. A
-- future post needs its own unique slug supplied by hand the same way
-- its title and messages already are.
--
-- The three existing posts' titles ("0차"/"1차"/"2차", numeral + Hangul)
-- romanize via slug.ts's own romanizeHangul() to 'Xcha' below — the
-- actual function output, not a guess.
alter table public.rp_posts add column slug text;

update public.rp_posts set slug = '0cha' where slug is null and title = '0차';
update public.rp_posts set slug = '1cha' where slug is null and title = '1차';
update public.rp_posts set slug = '2cha' where slug is null and title = '2차';

alter table public.rp_posts alter column slug set not null;
create unique index rp_posts_slug_idx on public.rp_posts (slug);
