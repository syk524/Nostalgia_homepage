-- ============================================================
-- 094 Memos
-- Archive > Memo board: editor/admin-authored sticky notes (text plus an
-- optional attached image), freely positioned on a shared corkboard —
-- shared, not per-account, unlike user_background_stickers (043), since
-- this is one team board rather than each editor's own arrangement.
-- Same editor-or-admin read/write split as archive_links (072), matching
-- the page's own notFound() gate (archive/memo/page.tsx).
-- ============================================================

create table public.memos (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles(id) on delete cascade,
  content      text not null default '',
  image_url    text,
  storage_path text,
  pos_x        double precision not null default 0,
  pos_y        double precision not null default 0,
  z            int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_memos_updated_at before update on public.memos
  for each row execute function public.handle_updated_at();

alter table public.memos enable row level security;

create policy "memos: editors read" on public.memos for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "memos: editors insert" on public.memos for insert with check (
  auth.uid() = author_id
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "memos: editors update" on public.memos for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "memos: editors delete" on public.memos for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

-- STORAGE: memo images
insert into storage.buckets (id, name, public)
values ('memo-images', 'memo-images', true)
on conflict do nothing;

create policy "memo-images: public read" on storage.objects for select using (
  bucket_id = 'memo-images'
);
create policy "memo-images: editors write" on storage.objects for insert with check (
  bucket_id = 'memo-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "memo-images: editors update" on storage.objects for update using (
  bucket_id = 'memo-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "memo-images: editors delete" on storage.objects for delete using (
  bucket_id = 'memo-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
