-- Client tasks RLS (read-only).
--   Clients: SELECT only, and ONLY tasks belonging to projects they own
--     (projects.client_id = auth.uid()), gated by is_client().
--   No INSERT/UPDATE/DELETE for clients (no matching policies).
--   Existing super-admin CRUD + staff own-task policies are unchanged.
-- Uses the same SECURITY DEFINER helper pattern as is_staff()/is_super_admin()/is_client().

drop policy if exists "Clients can view own project tasks" on public.tasks;
create policy "Clients can view own project tasks" on public.tasks
  for select to authenticated
  using (
    public.is_client()
    and exists (
      select 1 from public.projects
      where projects.id = tasks.project_id
        and projects.client_id = auth.uid()
    )
  );