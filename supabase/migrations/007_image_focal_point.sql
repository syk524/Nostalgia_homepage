-- ============================================================
-- 007 Thumbnail focal point
-- Lets an image be re-framed for its 16:9 gallery thumbnail crop
-- (object-position) without touching the original file. Defaults to
-- dead center, which matches today's behavior exactly.
-- ============================================================

alter table public.post_images
  add column focal_x smallint not null default 50 check (focal_x between 0 and 100),
  add column focal_y smallint not null default 50 check (focal_y between 0 and 100);
