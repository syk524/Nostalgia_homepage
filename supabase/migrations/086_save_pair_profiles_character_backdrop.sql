-- Re-declares save_pair_profiles (migration 076/078/080/082/084) to
-- also write character_backdrop_url (migration 085) — same signature,
-- create-or-replace.
create or replace function public.save_pair_profiles(p_pair_id uuid, p_profiles jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  profile_rec jsonb;
  char_rec jsonb;
  section_rec jsonb;
  entry_rec jsonb;
  new_profile_id uuid;
  new_char_id uuid;
begin
  delete from pair_profiles where pair_id = p_pair_id;

  for profile_rec in select * from jsonb_array_elements(p_profiles)
  loop
    insert into pair_profiles (
      pair_id, profile_slug, title, profile_title, title_font, title_color, title_size, icon_color,
      link_text, link_url, link_font, link_color, has_music,
      is_primary, page_type, custom_html_url,
      pair_image_url, character_backdrop_url,
      illustration_source, illustration_source_font, illustration_source_color,
      background_url, background_blur,
      background_overlay_color, background_overlay_opacity,
      particle_effect, particle_color,
      timeline_subtitle_font, timeline_title_font, timeline_text_color,
      timeline_dot_color, timeline_line_color, timeline_shadow,
      position
    ) values (
      p_pair_id,
      profile_rec->>'profile_slug', profile_rec->>'title', profile_rec->>'profile_title',
      profile_rec->>'title_font', profile_rec->>'title_color', (profile_rec->>'title_size')::int, profile_rec->>'icon_color',
      profile_rec->>'link_text', profile_rec->>'link_url', profile_rec->>'link_font', profile_rec->>'link_color', (profile_rec->>'has_music')::boolean,
      (profile_rec->>'is_primary')::boolean, profile_rec->>'page_type', profile_rec->>'custom_html_url',
      profile_rec->>'pair_image_url', profile_rec->>'character_backdrop_url',
      profile_rec->>'illustration_source', profile_rec->>'illustration_source_font', profile_rec->>'illustration_source_color',
      profile_rec->>'background_url', (profile_rec->>'background_blur')::int,
      profile_rec->>'background_overlay_color', (profile_rec->>'background_overlay_opacity')::int,
      profile_rec->>'particle_effect', profile_rec->>'particle_color',
      profile_rec->>'timeline_subtitle_font', profile_rec->>'timeline_title_font', profile_rec->>'timeline_text_color',
      profile_rec->>'timeline_dot_color', profile_rec->>'timeline_line_color', (profile_rec->>'timeline_shadow')::boolean,
      (profile_rec->>'position')::int
    )
    returning id into new_profile_id;

    for char_rec in select * from jsonb_array_elements(profile_rec->'characters')
    loop
      insert into profile_characters (
        profile_id, slot, name, name_color, name_font, name_underline_color, profile_image_url,
        catchphrase, catchphrase_color, catchphrase_font,
        quote, quote_color, quote_font,
        keyword_1, keyword_2, keyword_3, keyword_font, keyword_color,
        description_color,
        caption_shadow_color, caption_shadow_strength, caption_offset_y,
        age, height, weight, job, stats_color, stats_font,
        description_divider_url,
        caption_image_url, caption_image_position, caption_image_size
      ) values (
        new_profile_id, (char_rec->>'slot')::smallint,
        char_rec->>'name', char_rec->>'name_color', char_rec->>'name_font', char_rec->>'name_underline_color', char_rec->>'profile_image_url',
        char_rec->>'catchphrase', char_rec->>'catchphrase_color', char_rec->>'catchphrase_font',
        char_rec->>'quote', char_rec->>'quote_color', char_rec->>'quote_font',
        char_rec->>'keyword_1', char_rec->>'keyword_2', char_rec->>'keyword_3', char_rec->>'keyword_font', char_rec->>'keyword_color',
        char_rec->>'description_color',
        char_rec->>'caption_shadow_color', (char_rec->>'caption_shadow_strength')::numeric, (char_rec->>'caption_offset_y')::int,
        char_rec->>'age', char_rec->>'height', char_rec->>'weight', char_rec->>'job', char_rec->>'stats_color', char_rec->>'stats_font',
        char_rec->>'description_divider_url',
        char_rec->>'caption_image_url', char_rec->>'caption_image_position', (char_rec->>'caption_image_size')::int
      )
      returning id into new_char_id;

      for section_rec in select * from jsonb_array_elements(coalesce(char_rec->'sections', '[]'::jsonb))
      loop
        insert into description_sections (
          profile_character_id, position, title, title_color, title_font, description, text_color
        ) values (
          new_char_id, (section_rec->>'position')::smallint,
          section_rec->>'title', section_rec->>'title_color', section_rec->>'title_font',
          section_rec->>'description', section_rec->>'text_color'
        );
      end loop;
    end loop;

    for entry_rec in select * from jsonb_array_elements(coalesce(profile_rec->'timeline_entries', '[]'::jsonb))
    loop
      insert into timeline_entries (
        profile_id, position, subtitle, subtitle_color, title, title_color, description,
        char1_thought, char2_thought, image_url
      ) values (
        new_profile_id, (entry_rec->>'position')::smallint,
        entry_rec->>'subtitle', entry_rec->>'subtitle_color', entry_rec->>'title', entry_rec->>'title_color', entry_rec->>'description',
        entry_rec->>'char1_thought', entry_rec->>'char2_thought', entry_rec->>'image_url'
      );
    end loop;
  end loop;
end;
$$;
