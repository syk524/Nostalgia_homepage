alter table public.characters add column keyword_1 text;
alter table public.characters add column keyword_2 text;
alter table public.characters add column keyword_3 text;
alter table public.characters add column keyword_font text not null default 'default';
alter table public.characters add column keyword_color text not null default '#5c574d';
