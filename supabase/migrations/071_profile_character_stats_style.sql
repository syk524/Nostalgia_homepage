-- Independent color/font for the age/height/weight/job line — reported
-- directly, it was piggybacking on name_color/the default font with no
-- controls of its own. Same defaults as every other per-character color/
-- font field (name_color, catchphrase_font, ...).
alter table public.profile_characters
  add column stats_color text not null default '#5c574d',
  add column stats_font text not null default 'default';
