-- Character identity (name, avatar) isn't shared across eras either — a
-- profile_characters row now stands alone, so the separate characters
-- table (which only ever existed to hold shared identity) is no longer
-- needed. slot moves down from characters since profile_characters is now
-- the only place "which of the two people is this" is tracked.
alter table public.profile_characters
  add column slot smallint,
  add column name text,
  add column name_color text not null default '#5c574d',
  add column name_font text not null default 'default',
  add column profile_image_url text;

update public.profile_characters pc
set slot = c.slot, name = c.name, name_color = c.name_color, name_font = c.name_font, profile_image_url = c.profile_image_url
from public.characters c
where c.id = pc.character_id;

alter table public.profile_characters
  alter column slot set not null,
  alter column name set not null,
  add constraint profile_characters_slot_check check (slot in (1, 2)),
  add constraint profile_characters_profile_slot_unique unique (profile_id, slot);

alter table public.profile_characters drop column character_id;

drop table public.characters;
