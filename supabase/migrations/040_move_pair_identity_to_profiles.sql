-- Eras of the same pair share nothing but the grouping itself — no
-- consolidated pair-level title/link/icon-color anymore. Every profile
-- carries its own full set. profile_title already existed for tab/nav
-- labeling; it becomes the profile's one and only title (also the page H1),
-- so it's renamed rather than duplicated alongside a new title column.
alter table public.pair_profiles rename column profile_title to title;

alter table public.pair_profiles
  add column title_font text not null default 'default',
  add column title_color text not null default '#5c574d',
  add column title_size integer not null default 32,
  add column icon_color text not null default '#5c574d',
  add column link_text text,
  add column link_url text,
  add column link_font text not null default 'default',
  add column link_color text not null default '#5c574d',
  add column has_music boolean not null default false;

update public.pair_profiles pp
set title_font = cp.title_font, title_color = cp.title_color, title_size = cp.title_size,
    icon_color = cp.icon_color, link_text = cp.link_text, link_url = cp.link_url,
    link_font = cp.link_font, link_color = cp.link_color, has_music = cp.has_music
from public.character_pairs cp
where cp.id = pp.pair_id;

alter table public.character_pairs
  drop column title,
  drop column title_font,
  drop column title_color,
  drop column title_size,
  drop column icon_color,
  drop column link_text,
  drop column link_url,
  drop column link_font,
  drop column link_color,
  drop column has_music;
