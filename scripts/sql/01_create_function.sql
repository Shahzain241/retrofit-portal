create or replace function public.prevent_non_admin_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_super_admin() then
    raise exception 'Only a super admin can change a user''s role';
  end if;
  return new;
end;
$$;