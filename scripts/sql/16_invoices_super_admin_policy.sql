-- Super admins can read all invoices (for the admin Revenue Trend chart).
--   Mirrors the existing super-admin select policies on services/projects/
--   profiles: public.is_super_admin() is a SECURITY DEFINER helper reading
--   profiles.role. Clients keep the owner-only read (user_id = auth.uid());
--   insert/update/delete remain blocked for everyone (management-only writes).

drop policy if exists "Super admins can select invoices" on public.invoices;
create policy "Super admins can select invoices" on public.invoices
  for select to authenticated
  using (public.is_super_admin());