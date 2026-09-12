-- Adds a second gallery post type: "novel" — a book-reader UI (per-page
-- optional image + body paragraph, prev/next, progress) shown in the
-- same visual area image posts use for their carousel, per direct
-- request. post_type defaults to 'image' so every existing post is
-- unaffected. post_pages mirrors post_images' own shape/RLS/convention
-- (a real child table with a position column, wholesale deleted and
-- reinserted on every save — see updatePost in src/lib/actions/gallery.ts)
-- rather than a jsonb column, since it's a sibling of post_images on the
-- exact same parent table, which already established that convention.
alter table public.posts add column post_type text not null default 'image' check (post_type in ('image', 'novel'));

create table public.post_pages (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  position   int not null default 0,
  image_url  text,
  body       text not null default '',
  created_at timestamptz default now()
);
create index on public.post_pages(post_id, position);

alter table public.post_pages enable row level security;

create policy "post_pages: public read" on public.post_pages for select using (true);
create policy "post_pages: editors insert" on public.post_pages for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "post_pages: editors update" on public.post_pages for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "post_pages: editors delete" on public.post_pages for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
