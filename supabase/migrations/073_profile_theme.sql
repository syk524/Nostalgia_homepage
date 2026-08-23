-- Per-user landing page theme (background + point color). Validated
-- against the THEMES registry (src/lib/themes.ts) at the app layer, not
-- via a check constraint here, so adding a new theme later is just a
-- data change, not a migration.
alter table public.profiles
  add column if not exists theme text not null default 'default';
