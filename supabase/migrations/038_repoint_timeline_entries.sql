-- Timeline entries now belong to a profile (they vary per profile), not
-- the pair directly.
alter table public.timeline_entries add column profile_id uuid references public.pair_profiles(id) on delete cascade;

update public.timeline_entries te
set profile_id = pp.id
from public.pair_profiles pp
where pp.pair_id = te.pair_id and pp.is_primary;

alter table public.timeline_entries alter column profile_id set not null;
alter table public.timeline_entries drop column pair_id;
