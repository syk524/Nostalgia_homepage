alter table public.character_pairs add column link_text text;
alter table public.character_pairs add column link_url text;
alter table public.character_pairs add column link_font text not null default 'default';
alter table public.character_pairs add column link_color text not null default '#5c574d';
alter table public.character_pairs add column has_music boolean not null default false;
