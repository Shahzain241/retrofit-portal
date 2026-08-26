drop trigger if exists prevent_non_admin_role_change on public.profiles;
create trigger prevent_non_admin_role_change
before update of role on public.profiles
for each row
execute function public.prevent_non_admin_role_change();