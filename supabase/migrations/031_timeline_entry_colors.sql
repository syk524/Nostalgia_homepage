-- Subtitle and title get their own per-entry colors (like description
-- sections' per-section title_color), replacing the single pair-wide
-- timeline_text_color for those two fields. timeline_text_color stays on
-- character_pairs, now scoped to just the entry description body text.
alter table public.timeline_entries
  add column subtitle_color text not null default '#5c574d',
  add column title_color text not null default '#5c574d';
