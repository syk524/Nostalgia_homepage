-- Re-declares get_public_pair_grid (migration 052/089) to also return
-- swap_thumbnail_names (migration 091), so the grid card can apply it
-- for a guest too, same reasoning as world before it.
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
        'world', pp.world,
        'swap_thumbnail_names', pp.swap_thumbnail_names,
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
