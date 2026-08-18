-- Per-profile-per-character variant data (caption/keyword/shadow/offset) —
-- everything about a character that changes between profiles, as opposed
-- to their shared identity (name, avatar) which stays on characters.
create table public.profile_characters (
  id                     uuid primary key default gen_random_uuid(),
  profile_id             uuid not null references public.pair_profiles(id) on delete cascade,
  character_id           uuid not null references public.characters(id) on delete cascade,
  catchphrase            text,
  catchphrase_color      text not null default '#5c574d',
  catchphrase_font       text not null default 'default',
  quote                  text,
  quote_color            text not null default '#5c574d',
  quote_font             text not null default 'default',
  keyword_1              text,
  keyword_2              text,
  keyword_3              text,
  keyword_font           text not null default 'default',
  keyword_color          text not null default '#5c574d',
  description_color      text not null default '#5c574d',
  caption_shadow_color   text not null default '#000000',
  caption_shadow_strength numeric(3,1) not null default 2,
  caption_offset_y       integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (profile_id, character_id)
);

create trigger trg_profile_characters_updated_at before update on public.profile_characters
  for each row execute function public.handle_updated_at();

alter table public.profile_characters enable row level security;

create policy "profile_characters: public read" on public.profile_characters for select using (true);
create policy "profile_characters: editors insert" on public.profile_characters for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "profile_characters: editors update" on public.profile_characters for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "profile_characters: editors delete" on public.profile_characters for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

-- Backfill: one row per existing character, joined to that pair's
-- just-created primary profile.
insert into public.profile_characters (
  profile_id, character_id, catchphrase, catchphrase_color, catchphrase_font,
  quote, quote_color, quote_font, keyword_1, keyword_2, keyword_3, keyword_font, keyword_color,
  description_color, caption_shadow_color, caption_shadow_strength, caption_offset_y
)
select
  pp.id, c.id, c.catchphrase, c.catchphrase_color, c.catchphrase_font,
  c.quote, c.quote_color, c.quote_font, c.keyword_1, c.keyword_2, c.keyword_3, c.keyword_font, c.keyword_color,
  c.description_color, c.caption_shadow_color, c.caption_shadow_strength, c.caption_offset_y
from public.characters c
join public.pair_profiles pp on pp.pair_id = c.pair_id and pp.is_primary;

alter table public.characters
  drop column catchphrase,
  drop column catchphrase_color,
  drop column catchphrase_font,
  drop column quote,
  drop column quote_color,
  drop column quote_font,
  drop column keyword_1,
  drop column keyword_2,
  drop column keyword_3,
  drop column keyword_font,
  drop column keyword_color,
  drop column description_color,
  drop column caption_shadow_color,
  drop column caption_shadow_strength,
  drop column caption_offset_y;
