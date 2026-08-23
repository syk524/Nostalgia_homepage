-- description_sections.description switches from plain text (rendered
-- with whitespace-pre-wrap) to HTML (rendered through the new
-- pair-description-editor.tsx Tiptap view) — existing rows need
-- converting once so their line breaks don't collapse under an HTML
-- parser that doesn't treat bare "\n" as anything. Wraps the escaped text
-- in one <p>, turning every newline into <br>, which reproduces the old
-- whitespace-pre-wrap look exactly (one flowing block, every line break
-- preserved) rather than guessing at paragraph boundaries.
--
-- Guarded on "no existing tag" so this is safe to run more than once —
-- after the first pass every row starts with a real <p> tag and is
-- skipped on any re-run.
update public.description_sections
set description = '<p>' || replace(
  replace(
    replace(
      replace(description, '&', '&amp;'),
      '<', '&lt;'
    ),
    '>', '&gt;'
  ),
  E'\n', '<br>'
) || '</p>'
where description is not null
  and description !~ '<[a-zA-Z][^>]*>';
