-- ============================================================
-- 044 Calendar events
-- Unlike the sticker gallery, the calendar dock app is open to
-- everyone (dock apps always have been) -- what differs per viewer is
-- which events they can see. visibility maps directly onto the
-- existing three-tier role system: 'public' = everyone including
-- signed-out visitors, 'members' = any signed-in account (viewer and
-- up), 'private' = editor/admin only. Only editor/admin can create
-- events at all.
-- ============================================================

create table public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  event_date  date not null,
  title       text not null,
  dot_color   text not null default '#b23b2c',
  visibility  text not null default 'public' check (visibility in ('public', 'members', 'private')),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index on public.calendar_events(event_date);

create trigger trg_calendar_events_updated_at before update on public.calendar_events
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.calendar_events enable row level security;

create policy "calendar_events: read by visibility" on public.calendar_events for select using (
  visibility = 'public'
  or (visibility = 'members' and auth.uid() is not null)
  or (visibility = 'private' and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin')))
);
create policy "calendar_events: editors insert" on public.calendar_events for insert with check (
  auth.uid() = created_by
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "calendar_events: editors delete" on public.calendar_events for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
