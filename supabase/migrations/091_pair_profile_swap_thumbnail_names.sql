-- Swaps which character's name renders on which side of the pair grid
-- card's name row (character-pair-grid.tsx) — false (default) keeps the
-- existing slot-1-left/slot-2-right order every profile already has;
-- true puts slot 2's name on the left instead. Scoped to the thumbnail
-- only, per direct request — the detail page's own caption layout
-- (character-pair-hero.tsx) still always follows char1/char2 slot order
-- unaffected by this.
alter table public.pair_profiles
  add column swap_thumbnail_names boolean not null default false;
