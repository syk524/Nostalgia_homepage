-- Same per-page tint concept as pair_profiles.icon_color (021, 040), but
-- wider scope on this page — reported directly: also recolors the title,
-- date range, and description text, not just the nav icon/back button/
-- edit-delete controls the pair page's own icon_color touches.
alter table public.trpg_sessions
  add column icon_color text not null default '#5c574d';
