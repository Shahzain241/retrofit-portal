-- Client projects RLS.
--   Super-admins: full CRUD via is_super_admin() (same pattern as services/tasks).
--   Clients: read ONLY their OWN projects (client_id = auth.uid()).
--   This does NOT loosen access for any other role; staff/anon keep zero
--   access to projects (no matching policy).
-- Uses the same SECURITY DEFINER helper-function pattern as is_staff()/is_super_admin().

alter table public.projects enable row level security;

create or replace function public.is_client()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'client'
  );
$$;

-- Super-admins: full CRUD (INSERT/UPDATE/DELETE needed by backend/verify-scripts/verify-client-dashboard.cjs
-- to seed and clean up its two test projects)
drop policy if exists "Super admins can insert projects" on public.projects;
create policy "Super admins can insert projects" on public.projects
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "Super admins can update projects" on public.projects;
create policy "Super admins can update projects" on public.projects
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Super admins can delete projects" on public.projects;
create policy "Super admins can delete projects" on public.projects
  for delete to authenticated
  using (public.is_super_admin());

-- Clients: read only their own projects
drop policy if exists "Clients can view own projects" on public.projects;
create policy "Clients can view own projects" on public.projects
  for select to authenticated
  using (public.is_client() and client_id = auth.uid());