-- The sticker gallery (which stickers exist to place) is meant to be
-- browsable by every visitor, including guests — only managing it
-- (uploading/deleting) stays editor/admin only. The original read
-- policy required an editor/admin session for SELECT too, which
-- silently blocked anonymous/viewer reads (fetchStickerGallery
-- discards the RLS error and just returns []). Replace it with a
-- public-read policy, matching the pattern already used for
-- character_pairs/characters/pair_profiles.
drop policy if exists "sticker_gallery: editors read" on public.sticker_gallery;

create policy "sticker_gallery: public read"
  on public.sticker_gallery for select
  using (true);
