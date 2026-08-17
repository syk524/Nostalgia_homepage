-- Swap the on/off blur toggle for a selectable 1-100 strength.
alter table public.character_pairs drop column background_blur;
alter table public.character_pairs add column background_blur smallint not null default 1 check (background_blur between 1 and 100);
