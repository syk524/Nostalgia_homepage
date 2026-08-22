-- Small plain-text metadata shown below the title on each session's list
-- card (date_range) and a short description underneath it — both purely
-- freeform, no structured date parsing, since Roll20 session logs don't
-- carry a machine-readable session date/time anywhere in their own HTML.
alter table public.trpg_sessions
  add column date_range text,
  add column description text;
