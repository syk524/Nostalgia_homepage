-- ============================================================
-- 099 RP posts: cover image
-- Archive > RP's list moves from a plain text row to a thumbnail + title
-- card (matching TRPG's own SessionCard treatment) — reported directly.
-- ============================================================

alter table public.rp_posts add column cover_url text;
