-- ============================================================
-- 002 RLS Policies + Storage
-- Run AFTER 001_schema.sql
-- ============================================================

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.character_timeline_avatars enable row level security;
alter table public.timelines enable row level security;
alter table public.timeline_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_edits enable row level security;

-- PROFILES
create policy "profiles: anyone can read"  on public.profiles for select using (true);
create policy "profiles: owner can update" on public.profiles for update using (auth.uid() = id);

-- CHARACTERS
create policy "characters: anyone can read"   on public.characters for select using (true);
create policy "characters: owner can insert"  on public.characters for insert with check (auth.uid() = owner_id);
create policy "characters: owner can update"  on public.characters for update using (auth.uid() = owner_id);
create policy "characters: owner can delete"  on public.characters for delete using (auth.uid() = owner_id);

-- CHARACTER TIMELINE AVATARS
create policy "cta: anyone can read"  on public.character_timeline_avatars for select using (true);
create policy "cta: char owner insert" on public.character_timeline_avatars for insert
  with check (auth.uid() = (select owner_id from public.characters where id = character_id));
create policy "cta: char owner update" on public.character_timeline_avatars for update
  using (auth.uid() = (select owner_id from public.characters where id = character_id));
create policy "cta: char owner delete" on public.character_timeline_avatars for delete
  using (auth.uid() = (select owner_id from public.characters where id = character_id));

-- TIMELINES
create policy "timelines: select" on public.timelines for select
  using (is_public or creator_id = auth.uid()
    or exists (select 1 from public.timeline_members where timeline_id = id and user_id = auth.uid()));
create policy "timelines: insert" on public.timelines for insert with check (auth.uid() = creator_id);
create policy "timelines: owner update" on public.timelines for update using (auth.uid() = creator_id);
create policy "timelines: owner delete" on public.timelines for delete using (auth.uid() = creator_id);

-- TIMELINE MEMBERS
create policy "tm: members can read" on public.timeline_members for select
  using (user_id = auth.uid()
    or exists (select 1 from public.timeline_members t2 where t2.timeline_id = timeline_id and t2.user_id = auth.uid()));
create policy "tm: insert" on public.timeline_members for insert
  with check (user_id = auth.uid()
    or auth.uid() = (select creator_id from public.timelines where id = timeline_id));
create policy "tm: own update"  on public.timeline_members for update using (user_id = auth.uid());
create policy "tm: delete" on public.timeline_members for delete
  using (user_id = auth.uid()
    or auth.uid() = (select creator_id from public.timelines where id = timeline_id));

-- MESSAGES
create policy "msg: members read" on public.messages for select
  using (exists (select 1 from public.timeline_members where timeline_id = messages.timeline_id and user_id = auth.uid()));
create policy "msg: members insert" on public.messages for insert
  with check (auth.uid() = user_id
    and exists (select 1 from public.timeline_members where timeline_id = messages.timeline_id and user_id = auth.uid()));
create policy "msg: author update" on public.messages for update using (auth.uid() = user_id);
create policy "msg: delete" on public.messages for delete
  using (auth.uid() = user_id
    or auth.uid() = (select creator_id from public.timelines where id = timeline_id));

-- MESSAGE EDITS
create policy "edits: members read" on public.message_edits for select
  using (exists (
    select 1 from public.messages m
    join public.timeline_members tm on tm.timeline_id = m.timeline_id
    where m.id = message_id and tm.user_id = auth.uid()
  ));
create policy "edits: author insert" on public.message_edits for insert with check (auth.uid() = edited_by);

-- STORAGE BUCKETS
insert into storage.buckets (id, name, public) values ('user-icons', 'user-icons', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('character-avatars', 'character-avatars', true) on conflict do nothing;

-- Storage policies (path pattern: {userId}/filename)
create policy "user-icons: public read"  on storage.objects for select using (bucket_id = 'user-icons');
create policy "user-icons: owner write"  on storage.objects for insert with check (bucket_id = 'user-icons' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "user-icons: owner update" on storage.objects for update using  (bucket_id = 'user-icons' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "user-icons: owner delete" on storage.objects for delete using  (bucket_id = 'user-icons' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "char-avatars: public read"  on storage.objects for select using (bucket_id = 'character-avatars');
create policy "char-avatars: owner write"  on storage.objects for insert with check (bucket_id = 'character-avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "char-avatars: owner update" on storage.objects for update using  (bucket_id = 'character-avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "char-avatars: owner delete" on storage.objects for delete using  (bucket_id = 'character-avatars' and auth.uid()::text = (storage.foldername(name))[1]);
