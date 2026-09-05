-- ============================================================
-- 097 RP posts
-- Archive > RP: editor/admin-authored conversation-log posts, each one
-- a full RP log (a JSON array of {name, handle, avatar_url, html}
-- messages) rather than a normalized per-message table — the whole log
-- is written/imported as one unit, and nothing here needs to query,
-- edit, or reorder individual messages independently of their post.
-- Same editor-or-admin read/write split as memos (094) and archive_links
-- (072), matching the page's own notFound() gate (archive/rp/page.tsx).
-- ============================================================

create table public.rp_posts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  messages   jsonb not null default '[]'::jsonb,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_rp_posts_updated_at before update on public.rp_posts
  for each row execute function public.handle_updated_at();

alter table public.rp_posts enable row level security;

create policy "rp_posts: editors read" on public.rp_posts for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "rp_posts: editors insert" on public.rp_posts for insert with check (
  auth.uid() = author_id
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "rp_posts: editors update" on public.rp_posts for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "rp_posts: editors delete" on public.rp_posts for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
