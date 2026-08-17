alter table public.character_pairs drop column cover_url;

alter table public.characters
  add column catchphrase_color text not null default '#5c574d',
  add column quote_color text not null default '#5c574d';
