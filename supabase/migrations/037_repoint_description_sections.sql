-- Description sections now belong to a profile's version of a character
-- (they vary per profile), not the character directly.
alter table public.description_sections add column profile_character_id uuid references public.profile_characters(id) on delete cascade;

update public.description_sections ds
set profile_character_id = pc.id
from public.characters c
join public.pair_profiles pp on pp.pair_id = c.pair_id and pp.is_primary
join public.profile_characters pc on pc.profile_id = pp.id and pc.character_id = c.id
where ds.character_id = c.id;

alter table public.description_sections alter column profile_character_id set not null;
alter table public.description_sections drop column character_id;
