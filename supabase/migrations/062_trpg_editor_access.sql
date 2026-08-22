-- Widens TRPG session archive access from admin-only to editor-or-admin —
-- reported directly, matching the role split used everywhere else in
-- this app (gallery, pair profiles) instead of Archive's original
-- admin-only design (056_trpg_sessions.sql). Read/write on
-- trpg_sessions itself, plus write on the trpg-images storage bucket
-- (057_trpg_images_storage.sql) that session images/backgrounds upload
-- into — public read on that bucket is untouched: image URLs are
-- fetched by plain unauthenticated <img> requests regardless of who's
-- viewing the page, unrelated to who's allowed to author a session.

drop policy if exists "trpg_sessions: admin read" on public.trpg_sessions;
create policy "trpg_sessions: editors read" on public.trpg_sessions for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin')));

drop policy if exists "trpg_sessions: admin write" on public.trpg_sessions;
create policy "trpg_sessions: editors write" on public.trpg_sessions for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin')));

drop policy if exists "trpg_sessions: admin update" on public.trpg_sessions;
create policy "trpg_sessions: editors update" on public.trpg_sessions for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin')));

drop policy if exists "trpg_sessions: admin delete" on public.trpg_sessions;
create policy "trpg_sessions: editors delete" on public.trpg_sessions for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin')));

drop policy if exists "trpg-images: admin write" on storage.objects;
create policy "trpg-images: editors write" on storage.objects for insert with check (
  bucket_id = 'trpg-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

drop policy if exists "trpg-images: admin update" on storage.objects;
create policy "trpg-images: editors update" on storage.objects for update using (
  bucket_id = 'trpg-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

drop policy if exists "trpg-images: admin delete" on storage.objects;
create policy "trpg-images: editors delete" on storage.objects for delete using (
  bucket_id = 'trpg-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
