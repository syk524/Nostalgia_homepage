-- 050's trigger checked auth.uid() unconditionally, but auth.uid() is
-- NULL outside of an authenticated PostgREST/client request — which
-- includes the Supabase dashboard's SQL editor/table editor and any
-- service-role connection (confirmed: `select auth.uid()` returns null
-- there). As written, 050 would have blocked EVERY role change made
-- through those trusted, privileged paths too, since a trigger fires
-- regardless of RLS/role — there'd have been no way left to promote
-- anyone without temporarily dropping the trigger. Fix: only enforce
-- the admin check when there IS a signed-in acting user (auth.uid() is
-- not null); a null auth.uid() means this is a direct/service-role
-- operation, which — same as RLS's own service_role bypass — is
-- already a trusted context this isn't meant to restrict.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    ) then
      raise exception 'Only an admin can change a profile''s role.';
    end if;
  end if;
  return new;
end;
$$;
