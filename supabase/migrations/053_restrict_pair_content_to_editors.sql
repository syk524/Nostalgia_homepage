-- Narrows description_sections/timeline_entries (052 opened these to
-- any signed-in user) to editor/admin only. A plain viewer should only
-- ever see a pair's hero — title, pair image, the per-character
-- catchphrase/quote/keywords next to the picture, and the credit —
-- which all live on pair_profiles/profile_characters and stay open to
-- any signed-in user. Everything "starting from description" (the
-- long-form bio sections, and the timeline that comes after it) is now
-- gated the same way writes to these tables already are.
--
-- No component changes needed: fetchPairWithProfiles' nested select
-- gets an empty array back for a blocked embed rather than an error,
-- and every render path for both tables (character-pair-detail.tsx,
-- character-pair-timeline.tsx) already treats an empty array as
-- "render nothing" — confirmed by reading both files.

drop policy if exists "description_sections: signed-in read" on public.description_sections;
create policy "description_sections: editors read"
  on public.description_sections for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('editor', 'admin')
    )
  );

drop policy if exists "timeline_entries: signed-in read" on public.timeline_entries;
create policy "timeline_entries: editors read"
  on public.timeline_entries for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('editor', 'admin')
    )
  );
