-- New sign-ups now land on Noir by default, not the (now-relabeled
-- "Sticker") original theme — handle_new_user() (migration 001) never
-- sets theme explicitly, so it's always relied on this column default.
-- Existing rows already carrying 'default' are untouched; this only
-- changes what a brand-new profiles row gets when theme isn't specified.
alter table public.profiles
  alter column theme set default 'noir';
