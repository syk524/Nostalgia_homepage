-- Optional ambient overlay effect (rain, and more to come) shown on a
-- session's detail page, layered above the background image but below
-- the log's own text box. Nullable text, not a boolean, since this is
-- meant to grow into a set of effects (see particle-effects.tsx's own
-- PARTICLE_EFFECTS list) rather than a single on/off toggle.
alter table public.trpg_sessions
  add column particle_effect text;
