-- Age/height/weight/job shown on one line under the character's (re-shown)
-- name, above their description sections — reported directly. Plain text,
-- not numeric, matching this app's existing freeform-over-structured
-- convention for fields like trpg_sessions.date_range: height/weight are
-- rendered with a "cm"/"kg" suffix added at display time, not stored as
-- part of the value, so the stored text is just the number the editor
-- typed (or any other freeform value, if a number doesn't fit).
alter table public.profile_characters
  add column age text,
  add column height text,
  add column weight text,
  add column job text;
