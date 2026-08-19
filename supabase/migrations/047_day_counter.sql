-- ============================================================
-- 047 Day counter
-- A single global day-counter widget on the home desk (sibling to the
-- calendar's desk-widget pattern) — counts days since a fixed
-- reference date (kept in application code, not this table), with an
-- editor/admin-selectable background photo, text color, and font. One
-- row, seeded here; editors only ever update it, never insert/delete.
-- ============================================================

create table public.day_counter (
  id         uuid primary key default gen_random_uuid(),
  photo_url  text,
  text_color text not null default '#f1f1f1',
  font       text not null default 'default',
  updated_at timestamptz not null default now()
);

create trigger trg_day_counter_updated_at before update on public.day_counter
  for each row execute function public.handle_updated_at();

alter table public.day_counter enable row level security;

create policy "day_counter: public read" on public.day_counter for select using (true);
create policy "day_counter: editors update" on public.day_counter for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

insert into public.day_counter (text_color, font) values ('#f1f1f1', 'default');

-- STORAGE: day counter photo
insert into storage.buckets (id, name, public)
values ('day-counter-photos', 'day-counter-photos', true)
on conflict do nothing;

create policy "day-counter-photos: public read" on storage.objects for select using (
  bucket_id = 'day-counter-photos'
);
create policy "day-counter-photos: editors write" on storage.objects for insert with check (
  bucket_id = 'day-counter-photos'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "day-counter-photos: editors update" on storage.objects for update using (
  bucket_id = 'day-counter-photos'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "day-counter-photos: editors delete" on storage.objects for delete using (
  bucket_id = 'day-counter-photos'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
