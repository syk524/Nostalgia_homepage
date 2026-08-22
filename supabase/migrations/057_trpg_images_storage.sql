-- Storage bucket for images uploaded directly into a TRPG session's body
-- (via the editor's "Add image" toolbar button) — public read like every
-- other image bucket, but admin-only write/update/delete, matching
-- trpg_sessions' own admin-only RLS (056) rather than the broader
-- editor-or-admin shape gallery-images/profile-pages use, since Archive
-- stays admin-only end to end.
insert into storage.buckets (id, name, public)
values ('trpg-images', 'trpg-images', true)
on conflict do nothing;

create policy "trpg-images: public read" on storage.objects for select using (
  bucket_id = 'trpg-images'
);
create policy "trpg-images: admin write" on storage.objects for insert with check (
  bucket_id = 'trpg-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "trpg-images: admin update" on storage.objects for update using (
  bucket_id = 'trpg-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "trpg-images: admin delete" on storage.objects for delete using (
  bucket_id = 'trpg-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
