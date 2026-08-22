-- Sessions are now viewable by everyone, matching posts' and
-- character_pairs' own "public read" policy — writes (insert/update/
-- delete) stay editor/admin-only, unchanged.
drop policy "trpg_sessions: editors read" on public.trpg_sessions;
create policy "trpg_sessions: public read" on public.trpg_sessions
  for select using (true);
