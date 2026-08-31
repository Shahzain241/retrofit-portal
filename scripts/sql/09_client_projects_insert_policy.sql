-- Client projects INSERT policy.
--   Lets a client create a project row scoped to THEMSELVES:
--   with check (is_client() AND client_id = auth.uid()).
--   This mirrors the existing client SELECT policy ("Clients can view own
--   projects") and the super-admin INSERT policy pattern in
--   scripts/sql/07_client_projects_select_policy.sql. Staff/anon still get
--   zero INSERT access (no matching policy).

drop policy if exists "Clients can insert own projects" on public.projects;
create policy "Clients can insert own projects" on public.projects
  for insert to authenticated
  with check (public.is_client() and client_id = auth.uid());