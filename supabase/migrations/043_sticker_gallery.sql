-- ============================================================
-- 043 Sticker gallery
-- A shared image library (editor/admin managed) that any editor/admin
-- can drag onto the home page background as a draggable/resizable/
-- tiltable sticker. Placement is per-account, not shared — two editors
-- decorating their own view don't see each other's arrangement.
-- ============================================================

create table public.sticker_gallery (
  id           uuid primary key default gen_random_uuid(),
  image_url    text not null,
  storage_path text not null,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz default now()
);

create table public.user_background_stickers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  gallery_id   uuid not null references public.sticker_gallery(id) on delete cascade,
  pos_x        double precision not null default 0,
  pos_y        double precision not null default 0,
  scale        double precision not null default 1,
  rotation     double precision not null default 0,
  z            int not null default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index on public.user_background_stickers(user_id);

create trigger trg_user_background_stickers_updated_at before update on public.user_background_stickers
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.sticker_gallery enable row level security;
alter table public.user_background_stickers enable row level security;

-- The gallery itself is only ever fetched from editor/admin-only UI
-- (the sticker folder's click-to-open gallery), so read is gated the
-- same as write rather than left public.
create policy "sticker_gallery: editors read" on public.sticker_gallery for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "sticker_gallery: editors insert" on public.sticker_gallery for insert with check (
  auth.uid() = created_by
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "sticker_gallery: editors delete" on public.sticker_gallery for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

-- Placements are per-account: an editor/admin only ever sees and
-- writes their own rows.
create policy "user_background_stickers: own read" on public.user_background_stickers for select using (
  auth.uid() = user_id
);
create policy "user_background_stickers: own insert" on public.user_background_stickers for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "user_background_stickers: own update" on public.user_background_stickers for update using (
  auth.uid() = user_id
);
create policy "user_background_stickers: own delete" on public.user_background_stickers for delete using (
  auth.uid() = user_id
);

-- STORAGE: sticker images
insert into storage.buckets (id, name, public)
values ('sticker-images', 'sticker-images', true)
on conflict do nothing;

create policy "sticker-images: public read" on storage.objects for select using (
  bucket_id = 'sticker-images'
);
create policy "sticker-images: editors write" on storage.objects for insert with check (
  bucket_id = 'sticker-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "sticker-images: editors update" on storage.objects for update using (
  bucket_id = 'sticker-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "sticker-images: editors delete" on storage.objects for delete using (
  bucket_id = 'sticker-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
