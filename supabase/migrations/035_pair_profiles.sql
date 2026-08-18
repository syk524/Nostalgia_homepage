-- A pair can carry multiple profiles (e.g. different eras of the same two
-- characters). Everything visual/content-bearing that used to live
-- directly on character_pairs moves here, one row per profile; the pair
-- itself keeps only its shared identity (title, icon color, link).
create table public.pair_profiles (
  id                     uuid primary key default gen_random_uuid(),
  pair_id                uuid not null references public.character_pairs(id) on delete cascade,
  profile_slug           text not null,
  profile_title          text not null,
  is_primary             boolean not null default false,
  page_type              text not null default 'template' check (page_type in ('template', 'custom_html')),
  custom_html_url        text,
  pair_image_url         text,
  background_url         text,
  background_blur        integer not null default 1,
  timeline_subtitle_font text not null default 'default',
  timeline_title_font    text not null default 'default',
  timeline_text_color    text not null default '#5c574d',
  timeline_dot_color     text not null default '#5c574d',
  timeline_line_color    text not null default '#5c574d',
  timeline_shadow        boolean not null default false,
  position               smallint not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger trg_pair_profiles_updated_at before update on public.pair_profiles
  for each row execute function public.handle_updated_at();

-- At most one primary per pair, enforced in the DB; "at least one primary
-- always exists" is an application-layer guarantee (saveProfiles rejects
-- any save that doesn't have exactly one isPrimary).
create unique index pair_profiles_pair_slug_idx on public.pair_profiles (pair_id, profile_slug);
create unique index pair_profiles_one_primary_idx on public.pair_profiles (pair_id) where is_primary;

alter table public.pair_profiles enable row level security;

create policy "pair_profiles: public read" on public.pair_profiles for select using (true);
create policy "pair_profiles: editors insert" on public.pair_profiles for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "pair_profiles: editors update" on public.pair_profiles for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "pair_profiles: editors delete" on public.pair_profiles for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

-- Backfill: every existing pair becomes its own primary/template profile,
-- reusing the pair's own already-unique slug and title, carrying over the
-- visual/timeline columns this migration is about to drop from the parent.
insert into public.pair_profiles (
  pair_id, profile_slug, profile_title, is_primary, page_type,
  pair_image_url, background_url, background_blur,
  timeline_subtitle_font, timeline_title_font, timeline_text_color,
  timeline_dot_color, timeline_line_color, timeline_shadow, position
)
select
  id, slug, title, true, 'template',
  pair_image_url, background_url, background_blur,
  timeline_subtitle_font, timeline_title_font, timeline_text_color,
  timeline_dot_color, timeline_line_color, timeline_shadow, 0
from public.character_pairs;

alter table public.character_pairs
  drop column pair_image_url,
  drop column background_url,
  drop column background_blur,
  drop column timeline_subtitle_font,
  drop column timeline_title_font,
  drop column timeline_text_color,
  drop column timeline_dot_color,
  drop column timeline_line_color,
  drop column timeline_shadow;
