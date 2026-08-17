-- ============================================================
-- 006 Manual post ordering
-- Lets editors/admins drag-reorder the gallery. Backfilled from the
-- current created_at-desc order so nothing visibly moves on migrate.
-- ============================================================

alter table public.posts add column position integer not null default 0;

with ordered as (
  select id, row_number() over (order by created_at desc) - 1 as rn
  from public.posts
)
update public.posts
set position = ordered.rn
from ordered
where posts.id = ordered.id;

create index on public.posts(position);
