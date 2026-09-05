-- ============================================================
-- 098 RP images bucket
-- Storage for character portraits used as avatar_url in rp_posts'
-- messages (097) — public read (displayed to any editor/admin viewing
-- the post, same as memo-images), editor/admin write, matching every
-- other image bucket's policy shape in this project.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('rp-images', 'rp-images', true)
on conflict do nothing;

create policy "rp-images: public read" on storage.objects for select using (
  bucket_id = 'rp-images'
);
create policy "rp-images: editors write" on storage.objects for insert with check (
  bucket_id = 'rp-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "rp-images: editors update" on storage.objects for update using (
  bucket_id = 'rp-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "rp-images: editors delete" on storage.objects for delete using (
  bucket_id = 'rp-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
