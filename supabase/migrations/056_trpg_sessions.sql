-- Admin-only backup of Roll20/CoC chat-log sessions, one row per session
-- ("post"). The first role = 'admin'-only content table in the app —
-- every other gated table so far is role in ('editor', 'admin') — since
-- Archive stays admin-only end to end.
create table public.trpg_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.trpg_sessions
  for each row execute function public.handle_updated_at();

alter table public.trpg_sessions enable row level security;

create policy "trpg_sessions: admin read" on public.trpg_sessions for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "trpg_sessions: admin write" on public.trpg_sessions for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "trpg_sessions: admin update" on public.trpg_sessions for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "trpg_sessions: admin delete" on public.trpg_sessions for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
