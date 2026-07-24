-- ============================================================
-- 004 Playlist
-- Global sound player: a single shared track catalog, visible to
-- everyone (including logged-out visitors), but only editable
-- (add / remove) by users with editor or admin role — mirrors the
-- gallery posts authority model in 003.
--
-- Drops an earlier per-user-queue version of this migration if it
-- was already applied (owner_id/is_default schema + the now-removed
-- playlist_queue_order override table), so this file can be re-run
-- cleanly regardless of which version landed first.
-- ============================================================

drop table if exists public.playlist_queue_order cascade;
drop table if exists public.playlist_tracks cascade;

create table public.playlist_tracks (
  id          uuid primary key default gen_random_uuid(),
  added_by    uuid references public.profiles(id) on delete set null,
  source      text not null check (source in ('youtube', 'upload')),
  title       text not null,
  artist      text not null default 'Unknown Artist',
  -- youtube: 11-char video id. upload: storage object path in playlist-audio.
  source_ref  text not null,
  duration_seconds int,
  position    int not null default 0,
  created_at  timestamptz default now()
);

create index on public.playlist_tracks(position);

-- RLS
alter table public.playlist_tracks enable row level security;

create policy "playlist_tracks: public read" on public.playlist_tracks for select using (true);

create policy "playlist_tracks: editors insert" on public.playlist_tracks for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "playlist_tracks: editors update" on public.playlist_tracks for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "playlist_tracks: editors delete" on public.playlist_tracks for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

-- STORAGE: uploaded audio
insert into storage.buckets (id, name, public) values ('playlist-audio', 'playlist-audio', true) on conflict do nothing;

drop policy if exists "playlist-audio: public read" on storage.objects;
drop policy if exists "playlist-audio: owner write" on storage.objects;
drop policy if exists "playlist-audio: owner update" on storage.objects;
drop policy if exists "playlist-audio: owner delete" on storage.objects;
drop policy if exists "playlist-audio: editors write" on storage.objects;
drop policy if exists "playlist-audio: editors update" on storage.objects;
drop policy if exists "playlist-audio: editors delete" on storage.objects;

create policy "playlist-audio: public read" on storage.objects for select using (
  bucket_id = 'playlist-audio'
);
create policy "playlist-audio: editors write" on storage.objects for insert with check (
  bucket_id = 'playlist-audio'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "playlist-audio: editors update" on storage.objects for update using (
  bucket_id = 'playlist-audio'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "playlist-audio: editors delete" on storage.objects for delete using (
  bucket_id = 'playlist-audio'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

-- SEED: shared default track set. Add more later via the dashboard/SQL editor.
-- insert into public.playlist_tracks (source, title, artist, source_ref, position)
-- values
--   ('youtube', 'Example Track', 'Example Artist', 'dQw4w9WgXcQ', 0);

