-- ============================================================
-- 095 Memos: switch to grid layout
-- Free positioning (pos_x/pos_y/z, from 094) is replaced by a fixed grid
-- ordered by created_at — reported directly, in favor of a uniform 1:1
-- tile layout instead of a corkboard. Dropping the columns rather than
-- leaving them unused: nothing reads them any more, and a grid has no
-- concept of manual placement to eventually revive them for.
-- ============================================================

alter table public.memos
  drop column pos_x,
  drop column pos_y,
  drop column z;
