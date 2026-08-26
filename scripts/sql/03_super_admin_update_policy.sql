drop policy if exists "Super admins can update all profiles" on public.profiles;
create policy "Super admins can update all profiles"
on public.profiles
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());