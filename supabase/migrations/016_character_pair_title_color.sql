-- Default matches the app's own --ink color, so existing/new pairs that
-- don't touch this keep looking the same as before this field existed.
alter table public.character_pairs add column title_color text not null default '#5c574d';
