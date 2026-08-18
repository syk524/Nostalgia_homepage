-- Re-separates the two title concepts: `title` is the actual page H1,
-- `profile_title` is the short label used only for the tab (edit page)
-- and side-nav item (public page) — these were merged into one column in
-- 040, but that lost the ability to have a display heading that differs
-- from a short identifying label (e.g. title "Finding the Path — Reunion"
-- vs. profile_title "Reunion Era"). Backfilled from the existing title so
-- nothing goes blank; editors can now diverge them per profile.
alter table public.pair_profiles add column profile_title text;
update public.pair_profiles set profile_title = title where profile_title is null;
alter table public.pair_profiles alter column profile_title set not null;
