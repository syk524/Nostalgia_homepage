-- ============================================================
-- 003 Gallery + Roles
-- Drops the old storytelling schema (0 rows, confirmed unused)
-- and adds role-based authority + the gallery feature.
-- ============================================================

-- Drop old storytelling tables (children first)
drop table if exists public.message_edits cascade;
drop table if exists public.messages cascade;
drop table if exists public.timeline_personas cascade;
drop table if exists public.timeline_members cascade;
drop table if exists public.character_timeline_avatars cascade;
drop table if exists public.timelines cascade;
drop table if exists public.characters cascade;

-- Drop now-unused profile columns from the old "character" concept
alter table public.profiles drop column if exists bio_name;
alter table public.profiles drop column if exists bio_avatar_url;

-- ROLES
alter table public.profiles
  add column if not exists role text not null default 'viewer'
  check (role in ('viewer', 'editor', 'admin'));

-- Re-create signup trigger: first-ever signup becomes admin (bootstrap),
-- everyone after that starts as viewer.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  is_first boolean;
begin
  select not exists (select 1 from public.profiles) into is_first;

  insert into public.profiles (id, username, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case when is_first then 'admin' else 'viewer' end
  );
  return new;
end;
$$ language plpgsql security definer;

-- GALLERY POSTS
create table public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  body        text not null,
  is_edited   boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table public.post_images (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  image_url   text not null,
  position    int not null default 0,
  created_at  timestamptz default now()
);

create index on public.posts(created_at desc);
create index on public.post_images(post_id, position);

create trigger trg_posts_updated_at before update on public.posts
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.posts enable row level security;
alter table public.post_images enable row level security;

create policy "posts: public read" on public.posts for select using (true);
create policy "posts: editors insert" on public.posts for insert with check (
  auth.uid() = author_id
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "posts: editors update" on public.posts for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "posts: editors delete" on public.posts for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

create policy "post_images: public read" on public.post_images for select using (true);
create policy "post_images: editors insert" on public.post_images for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "post_images: editors update" on public.post_images for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "post_images: editors delete" on public.post_images for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

-- STORAGE: gallery images
insert into storage.buckets (id, name, public)
values ('gallery-images', 'gallery-images', true)
on conflict do nothing;

create policy "gallery-images: public read" on storage.objects for select using (
  bucket_id = 'gallery-images'
);
create policy "gallery-images: editors write" on storage.objects for insert with check (
  bucket_id = 'gallery-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "gallery-images: editors update" on storage.objects for update using (
  bucket_id = 'gallery-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "gallery-images: editors delete" on storage.objects for delete using (
  bucket_id = 'gallery-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

-- (applied as a separate follow-up migration `security_hardening_cleanup`:
--  drop orphaned public.is_timeline_member(uuid) left over from the old
--  timelines feature, and pin search_path=public on handle_new_user /
--  handle_updated_at per Supabase advisor recommendation)
