-- ============================================================
-- 005 Gallery categories
-- Lets each post carry exactly one category (Commission/Drawing/Etc
-- seeded, more addable later including inline from the upload form).
-- ============================================================

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  integer generated always as identity,
  created_at  timestamptz default now()
);

-- Case-insensitive uniqueness — matters once users create categories on the
-- fly from the upload form ("Etc" vs "etc" shouldn't both exist).
create unique index categories_name_lower_idx on public.categories (lower(name));

alter table public.categories enable row level security;

create policy "categories: public read" on public.categories for select using (true);
create policy "categories: editors insert" on public.categories for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

insert into public.categories (name) values ('Commission'), ('Drawing'), ('Etc');

-- Add as nullable first so existing posts can be backfilled, then require it.
alter table public.posts add column category_id uuid references public.categories(id) on delete restrict;
update public.posts set category_id = (select id from public.categories where name = 'Etc') where category_id is null;
alter table public.posts alter column category_id set not null;
