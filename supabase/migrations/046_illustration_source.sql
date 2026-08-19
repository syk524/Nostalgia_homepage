-- Attribution for a profile's hero artwork (e.g. "©망붕"). Stored without
-- the © — that's added at render time — so editors can freely re-edit the
-- name without fighting a baked-in prefix. Font/color are user-selectable
-- like every other pair text field; the thumbnail grid ignores both and
-- always renders in a fixed Noto Sans KR Light / #5B574E, per the design.
alter table public.pair_profiles
  add column illustration_source text,
  add column illustration_source_font text not null default 'default',
  add column illustration_source_color text not null default '#5c574d';
