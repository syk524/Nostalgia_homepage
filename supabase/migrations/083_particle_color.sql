-- Optional custom color for the particle effect on both surfaces that
-- have one (particle_effect, already on both tables) — nullable so an
-- unset value falls back to that effect's own built-in default color
-- (DEFAULT_PARTICLE_COLORS in particle-effects.tsx) rather than needing
-- a stored default that would have to track that file's own values.
alter table public.trpg_sessions
  add column particle_color text;

alter table public.pair_profiles
  add column particle_color text;
