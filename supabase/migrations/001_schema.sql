-- ============================================================
-- 001 Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- PROFILES (extends auth.users)
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  display_name  text,
  user_icon_url text,
  bio           text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- CHARACTERS
create table public.characters (
  id              uuid primary key default uuid_generate_v4(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  name            text not null,
  bio             text,
  base_avatar_url text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- TIMELINES
create table public.timelines (
  id          uuid primary key default uuid_generate_v4(),
  creator_id  uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text,
  is_public   boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- PER-TIMELINE CHARACTER AVATARS
create table public.character_timeline_avatars (
  id           uuid primary key default uuid_generate_v4(),
  character_id uuid not null references public.characters(id) on delete cascade,
  timeline_id  uuid not null references public.timelines(id) on delete cascade,
  avatar_url   text not null,
  created_at   timestamptz default now(),
  unique(character_id, timeline_id)
);

-- TIMELINE MEMBERS
create table public.timeline_members (
  id           uuid primary key default uuid_generate_v4(),
  timeline_id  uuid not null references public.timelines(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  role         text default 'member' check (role in ('owner','member')),
  joined_at    timestamptz default now(),
  unique(timeline_id, user_id)
);

-- MESSAGES
create table public.messages (
  id           uuid primary key default uuid_generate_v4(),
  timeline_id  uuid not null references public.timelines(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  content      text not null,
  is_edited    boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- MESSAGE EDIT HISTORY
create table public.message_edits (
  id          uuid primary key default uuid_generate_v4(),
  message_id  uuid not null references public.messages(id) on delete cascade,
  old_content text not null,
  edited_at   timestamptz default now(),
  edited_by   uuid not null references public.profiles(id) on delete cascade
);

-- INDEXES
create index on public.messages(timeline_id, created_at);
create index on public.characters(owner_id);
create index on public.timeline_members(timeline_id);
create index on public.timeline_members(user_id);
create index on public.message_edits(message_id);

-- AUTO updated_at
create or replace function public.handle_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;

create trigger trg_profiles_updated_at  before update on public.profiles  for each row execute function public.handle_updated_at();
create trigger trg_characters_updated_at before update on public.characters for each row execute function public.handle_updated_at();
create trigger trg_timelines_updated_at  before update on public.timelines  for each row execute function public.handle_updated_at();
create trigger trg_messages_updated_at   before update on public.messages   for each row execute function public.handle_updated_at();

-- AUTO-CREATE PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
