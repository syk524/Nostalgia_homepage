-- Replaces each character's single description field with a reorderable
-- list of description sections (title + body, each independently colored).
-- No unique constraint on position — same convention as posts.position:
-- the whole set is rewritten (delete + reinsert) on every save, so nothing
-- ever relies on the column staying unique in the database itself.
create table public.description_sections (
  id           uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  position     smallint not null default 0,
  title        text,
  title_color  text not null default '#5c574d',
  description  text not null default '',
  text_color   text not null default '#5c574d',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_description_sections_updated_at before update on public.description_sections
  for each row execute function public.handle_updated_at();

alter table public.description_sections enable row level security;

create policy "description_sections: public read" on public.description_sections for select using (true);
create policy "description_sections: editors insert" on public.description_sections for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "description_sections: editors update" on public.description_sections for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);
create policy "description_sections: editors delete" on public.description_sections for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'))
);

-- Backfill: each character's existing single description becomes section 0
-- (no title — there wasn't one before), carrying its old text color over.
insert into public.description_sections (character_id, position, title, description, text_color)
select id, 0, null, description, description_text_color
from public.characters
where description is not null and description <> '';

-- description_color (the full-width background glow) stays on characters —
-- it's still one color per character, applying behind all of that
-- character's stacked sections. Only the per-text-field columns move to
-- the new per-section table.
alter table public.characters drop column description;
alter table public.characters drop column description_text_color;
