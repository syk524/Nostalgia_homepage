-- TRPG session detail-page background — same shape as pair_profiles'
-- background_url/background_blur (035_pair_profiles.sql): a full-bleed,
-- user-uploaded image behind the page content, with an adjustable blur
-- strength stored as a 1-100 integer (mapped to a 0-40px CSS blur radius
-- at render time, same formula character-pair-detail.tsx already uses).
alter table public.trpg_sessions
  add column background_url text,
  add column background_blur integer not null default 1;
