-- Guests can now view a pair's own hero content (title, image, names,
-- catchphrase/quote) — same as any signed-in viewer already could.
-- description_sections and timeline_entries stay editor/admin-only,
-- unchanged, so a guest sees a pair's profile "post" only up through the
-- hero and never the description/timeline content beneath it.
drop policy "pair_profiles: signed-in read" on public.pair_profiles;
create policy "pair_profiles: public read" on public.pair_profiles
  for select using (true);

drop policy "profile_characters: signed-in read" on public.profile_characters;
create policy "profile_characters: public read" on public.profile_characters
  for select using (true);
