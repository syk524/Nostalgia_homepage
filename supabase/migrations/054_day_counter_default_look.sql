-- New default appearance for the day counter: a specific gallery photo
-- as background, 조선명조체 (the 'serif' key in PAIR_FONTS) as the
-- font, and white text — until an editor changes it via the widget's
-- own edit form. Column defaults are updated too so this stays the
-- baseline if the row is ever reset, though in practice there's only
-- ever the one singleton row.
alter table public.day_counter alter column text_color set default '#FFFFFF';
alter table public.day_counter alter column font set default 'serif';

update public.day_counter
set
  photo_url = 'https://iawxsciepocpadlfgwuf.supabase.co/storage/v1/object/public/gallery-images/e8ea2041-183f-41a5-9a4e-60cfa5f28a1c/1786982444698-bf0mfo.webp',
  -- Not this feature's own upload (it's an existing gallery image, not
  -- one owned by the day-counter-photos bucket) — left null so a
  -- future photo swap's cleanup logic never tries to delete a shared
  -- gallery asset out from under the gallery it belongs to.
  photo_path = null,
  text_color = '#FFFFFF',
  font = 'serif';
