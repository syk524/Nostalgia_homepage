-- Same shape as trpg_sessions.particle_effect: nullable freeform text,
-- validated against PARTICLE_EFFECTS (particle-effects.tsx) at the app
-- layer rather than a check constraint, so adding a new effect value
-- there doesn't also need a migration here.
alter table public.pair_profiles
  add column particle_effect text;
