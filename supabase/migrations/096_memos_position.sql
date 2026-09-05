-- ============================================================
-- 096 Memos: add back manual ordering, grid-reorder this time
-- created_at (095) can't represent an arbitrary drag-to-reorder — a
-- memo's position in the grid needs to be independent of when it was
-- created. Backfilled from the existing created_at order so today's
-- layout doesn't visibly reshuffle the moment this ships.
-- ============================================================

alter table public.memos add column position int not null default 0;

with ordered as (
  select id, row_number() over (order by created_at) - 1 as rn
  from public.memos
)
update public.memos set position = ordered.rn
from ordered
where memos.id = ordered.id;
