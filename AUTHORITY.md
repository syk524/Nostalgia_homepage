# Authority & Roles

This document describes who can do what on Nostalgia, and how that's enforced today. It's a living doc — the model here is intentionally simple for v1 and is expected to change as the site grows.

## Roles

Every account (`public.profiles`) has a `role` column: `viewer`, `editor`, or `admin`.

| Role     | Can do |
|----------|--------|
| `viewer` | Log in, set their own nickname/avatar/bio. Read everything public (landing page, Gallery). Cannot create or edit posts. |
| `editor` | Everything a `viewer` can do, **plus** create, edit, and delete **any** Gallery post — not just their own. |
| `admin`  | Everything an `editor` can do. (Role management is manual for now — see below — but `admin` is reserved for whoever should eventually get an in-app role-management UI.) |

New signups default to `viewer`. **The very first account ever created on the site automatically becomes `admin`** (a bootstrap trigger checks whether `profiles` is empty at signup time) — this exists so there's always at least one person who can promote others, since nothing else can grant the first admin.

## A deliberate v1 choice: edit authority is site-wide, not per-post

An `editor` can edit or delete *any* Gallery post, not just the ones they authored. This matches the original request — "authority to edit the website" — and treats the Gallery as a shared, collaborative space rather than a set of personal blogs.

This is very likely the first thing to revisit. A more conventional model would let authors edit their own posts, with `editor`/`admin` as an override for moderation. If the Gallery starts feeling more personal than communal, switch to that — it's a small RLS change (see below).

## How role assignment works today

There's no in-app UI for changing someone's role yet. To promote or demote someone:

1. Open the Supabase dashboard for project `iawxsciepocpadlfgwuf` ("Findingthepath") → Table Editor → `profiles`.
2. Edit the `role` cell for that user directly (or run `update public.profiles set role = 'editor' where username = '...';` in the SQL editor).

This is fine at the current scale (a handful of people). It should become an in-app admin screen once that stops being true.

## Enforcement

Authority is enforced at the database layer via Postgres Row-Level Security (RLS) on `posts`, `post_images`, and the `gallery-images` storage bucket — not just in the UI. Every write policy re-checks the caller's `role` against `profiles` on each request, so a `viewer` can't create/edit/delete posts even by calling the Supabase API directly; UI-level role checks (e.g. hiding the "New Post" button) are a convenience, not the actual security boundary.

## Why Supabase over Cloudflare

This was evaluated when building the login system. Supabase was chosen because:
- It bundles Postgres, Auth, file Storage, and Row-Level Security into one product, which is exactly the shape this app needs (structured posts + images + per-role permissions).
- A Supabase project (`iawxsciepocpadlfgwuf`) was already live and working in this codebase before this build started.
- The Cloudflare alternative (D1 + R2/KV + Workers, plus a separate auth library) would have meant assembling several separate pieces from scratch with no existing setup to build on.

## What's likely to change next

- An in-app role-management UI (currently manual, via the Supabase dashboard).
- Possibly moving from site-wide edit authority to per-post ownership (with `editor`/`admin` as an override) — see above.
- An invite or approval flow for new signups, if the site grows past people you already know.
- Real roles/permissions for the Archive and Profile features once they're built out (this doc currently only covers Gallery, since that's what exists).
