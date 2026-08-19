-- Tracks the storage object path alongside the public URL, same shape
-- as sticker_gallery.storage_path — needed so a replaced photo's old
-- file can be deleted from the day-counter-photos bucket by path
-- rather than parsing it back out of the public URL string.
alter table public.day_counter add column photo_path text;
