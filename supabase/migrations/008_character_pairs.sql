-- Character-pair profile archive: each registered entry is a pair of two
-- characters (slot 1 / slot 2), with an optional per-pair background image.
-- Same public-read / editor-admin-write RLS shape as posts (003).

create table public.character_pairs (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  background_url text,
  created_by     uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.characters (
  id           uuid primary key default gen_random_uuid(),
  pair_id      uuid not null references public.character_pairs(id) on delete cascade,
  slot         smallint not null check (slot in (1, 2)),
  name         text not null,
  quote        text,
  description  text,
  image_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (pair_id, slot)
);

create trigger trg_character_pairs_updated_at before update on public.character_pairs
  for each row execute function public.handle_updated_at();
create trigger trg_characters_updated_at before update on public.characters
  for each row execute function public.handle_updated_at();

alter table public.character_pairs enable row level security;
alter table public.characters enable row level security;

create policy "character_pairs: public read" on public.character_pairs for select using (true);
create policy "character_pairs: editors insert" on public.character_pairs for insert with check (
  auth.uid() = created_by
  and exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "character_pairs: editors update" on public.character_pairs for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "character_pairs: editors delete" on public.character_pairs for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

create policy "characters: public read" on public.characters for select using (true);
create policy "characters: editors insert" on public.characters for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "characters: editors update" on public.characters for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "characters: editors delete" on public.characters for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
