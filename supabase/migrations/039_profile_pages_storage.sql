-- Storage bucket for uploaded custom-HTML profile pages — same
-- public-read / editor-write shape as gallery-images.
insert into storage.buckets (id, name, public)
values ('profile-pages', 'profile-pages', true)
on conflict do nothing;

create policy "profile-pages: public read" on storage.objects for select using (
  bucket_id = 'profile-pages'
);
create policy "profile-pages: editors write" on storage.objects for insert with check (
  bucket_id = 'profile-pages'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "profile-pages: editors update" on storage.objects for update using (
  bucket_id = 'profile-pages'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "profile-pages: editors delete" on storage.objects for delete using (
  bucket_id = 'profile-pages'
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
