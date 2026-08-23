-- New table backing the Archive > Links page — a simple editor-curated
-- list of external links, each previewable in an iframe on selection (see
-- links-archive-view.tsx). Same editor-or-admin read/write split as
-- trpg_sessions (062_trpg_editor_access.sql), reported directly — the
-- page itself is already gated the same way (archive/links/page.tsx's own
-- notFound() check), so this just backs that with matching RLS rather
-- than leaving the table itself readable by anyone with a client.

create table public.archive_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.archive_links enable row level security;

create policy "archive_links: editors read" on public.archive_links for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin')));

create policy "archive_links: editors write" on public.archive_links for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin')));

create policy "archive_links: editors update" on public.archive_links for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin')));

create policy "archive_links: editors delete" on public.archive_links for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin')));
