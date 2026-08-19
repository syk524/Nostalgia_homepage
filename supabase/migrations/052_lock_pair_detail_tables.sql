-- Closes the gap where a pair's full detail data (pair_profiles,
-- profile_characters, description_sections, timeline_entries) was
-- readable by anyone at the database level even though the Next.js
-- route for an individual pair page (/profile/[slug]) requires login.
-- The /profile grid itself must stay public — it's the one place a
-- guest is allowed to see a *summary* (title, thumbnail, character
-- names). Since Postgres RLS is row-level, not column-level, there's
-- no way to make "some columns of this row" public and "the rest"
-- private on the same policy — so the grid's summary query is moved
-- into a security definer RPC that returns only the safe fields
-- (bypassing RLS internally, the same way a service role would), and
-- the underlying tables get locked to logged-in-only reads.
--
-- Detail pages (fetchPairWithProfiles in character-pair-queries.ts)
-- are unaffected: both routes that call it are already behind the
-- middleware login wall, so they'll keep working under the tightened
-- policies exactly as they do now for a signed-in viewer.

create or replace function public.get_public_pair_grid()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', cp.id,
    'created_by', cp.created_by,
    'created_at', cp.created_at,
    'updated_at', cp.updated_at,
    'slug', cp.slug,
    'pair_profiles', jsonb_build_array(
      jsonb_build_object(
        'title', pp.title,
        'title_font', pp.title_font,
        'pair_image_url', pp.pair_image_url,
        'illustration_source', pp.illustration_source,
        'background_url', pp.background_url,
        'profile_characters', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'name', pc.name,
              'name_color', pc.name_color,
              'name_font', pc.name_font,
              'slot', pc.slot
            ) order by pc.slot
          ), '[]'::jsonb)
          from public.profile_characters pc
          where pc.profile_id = pp.id
        )
      )
    )
  )
  from public.character_pairs cp
  join public.pair_profiles pp on pp.pair_id = cp.id and pp.is_primary = true
  order by cp.created_at desc;
$$;

grant execute on function public.get_public_pair_grid() to anon, authenticated;

drop policy if exists "pair_profiles: public read" on public.pair_profiles;
create policy "pair_profiles: signed-in read"
  on public.pair_profiles for select
  using (auth.uid() is not null);

drop policy if exists "profile_characters: public read" on public.profile_characters;
create policy "profile_characters: signed-in read"
  on public.profile_characters for select
  using (auth.uid() is not null);

drop policy if exists "description_sections: public read" on public.description_sections;
create policy "description_sections: signed-in read"
  on public.description_sections for select
  using (auth.uid() is not null);

drop policy if exists "timeline_entries: public read" on public.timeline_entries;
create policy "timeline_entries: signed-in read"
  on public.timeline_entries for select
  using (auth.uid() is not null);
