-- "profiles: owner can update" (002_rls_and_storage.sql) lets a user
-- update every column on their own row, including `role` — nothing
-- stops a signed-in viewer from calling Supabase directly and setting
-- their own role to 'admin'. A `with check` on the RLS policy can't
-- compare the incoming role against the row's *current* role (it only
-- sees the new row), so this is enforced with a trigger instead: block
-- the update outright when `role` is actually changing and the acting
-- user isn't already an admin. A normal profile edit (name/bio/avatar)
-- never touches `role` in its update payload, so `new.role` and
-- `old.role` stay equal and this trigger has nothing to do — only an
-- explicit attempt to change `role` trips it. security definer + a
-- pinned search_path so the trigger's own lookup of the acting user's
-- role isn't itself blocked by RLS or hijackable via search_path.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    ) then
      raise exception 'Only an admin can change a profile''s role.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_role_escalation on public.profiles;
create trigger profiles_prevent_self_role_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_self_role_escalation();
