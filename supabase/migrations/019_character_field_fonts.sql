alter table public.characters
  add column name_font text not null default 'default',
  add column catchphrase_font text not null default 'default',
  add column quote_font text not null default 'default';
