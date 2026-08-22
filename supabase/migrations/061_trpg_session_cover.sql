-- Denormalized cover image for the session list page's grid — computed
-- client-side at save time from whichever image in the body carries
-- data-cover="true" (see TrpgImageView's star-toggle in
-- trpg-session-editor.tsx), not re-derived from the body on every list
-- render. Nullable: a session with no cover picked yet just shows a
-- placeholder tile in the grid.
alter table public.trpg_sessions add column cover_url text;
