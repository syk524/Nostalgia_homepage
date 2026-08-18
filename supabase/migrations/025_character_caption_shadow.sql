-- User-configurable text-shadow (glow-style: 0 0 blur color, no offset —
-- reads as a soft border around the letterforms rather than a drop
-- shadow) applied to a character's catchphrase, name, and quote in the
-- hero overlay. One shared color/strength per character, same as the
-- existing description_color glow, rather than three separate controls.
alter table public.characters add column caption_shadow_color text not null default '#000000';
alter table public.characters add column caption_shadow_strength numeric(3,1) not null default 2.0;
