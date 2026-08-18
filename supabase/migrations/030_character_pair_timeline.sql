-- Consolidated pair-level timeline: one shared sequence of entries per
-- pair (not per character) telling the overview of the pair's story.
-- Style (fonts/colors/dot/line/shadow) lives on character_pairs as a
-- single shared setting for the whole timeline, mirroring the keywords
-- pattern (one font+color for all three keywords, not per-keyword) rather
-- than description_sections' per-item styling.
alter table public.character_pairs
  add column timeline_subtitle_font text not null default 'default',
  add column timeline_title_font text not null default 'default',
  add column timeline_text_color text not null default '#5c574d',
  add column timeline_dot_color text not null default '#5c574d',
  add column timeline_line_color text not null default '#5c574d',
  add column timeline_shadow boolean not null default false;

create table public.timeline_entries (
  id            uuid primary key default gen_random_uuid(),
  pair_id       uuid not null references public.character_pairs(id) on delete cascade,
  position      smallint not null default 0,
  subtitle      text,
  title         text,
  description   text,
  char1_thought text,
  char2_thought text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_timeline_entries_updated_at before update on public.timeline_entries
  for each row execute function public.handle_updated_at();

alter table public.timeline_entries enable row level security;

create policy "timeline_entries: public read" on public.timeline_entries for select using (true);
create policy "timeline_entries: editors insert" on public.timeline_entries for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "timeline_entries: editors update" on public.timeline_entries for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "timeline_entries: editors delete" on public.timeline_entries for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
