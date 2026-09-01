-- Tasks RLS.
--   Super-admins: full CRUD (is_super_admin(), same pattern as services/projects).
--   Staff (coordinator/designer/assessor): read + update their OWN assigned tasks;
--     WITH CHECK prevents reassigning to someone else; no insert/delete policies.
--   Clients: no policies match, so zero access.
-- Uses SECURITY DEFINER helpers (no inline EXISTS subqueries on profiles).

alter table public.tasks enable row level security;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('coordinator', 'designer', 'assessor')
  );
$$;

-- Super-admins: full CRUD
drop policy if exists "Super admins can select tasks" on public.tasks;
create policy "Super admins can select tasks" on public.tasks
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists "Super admins can insert tasks" on public.tasks;
create policy "Super admins can insert tasks" on public.tasks
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists "Super admins can update tasks" on public.tasks;
create policy "Super admins can update tasks" on public.tasks
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Super admins can delete tasks" on public.tasks;
create policy "Super admins can delete tasks" on public.tasks
  for delete to authenticated
  using (public.is_super_admin());

-- Staff: read + update their own assigned tasks (no reassign / delete / insert)
drop policy if exists "Staff can read own tasks" on public.tasks;
create policy "Staff can read own tasks" on public.tasks
  for select to authenticated
  using (public.is_staff() and assignee_id = auth.uid());

drop policy if exists "Staff can update own tasks" on public.tasks;
create policy "Staff can update own tasks" on public.tasks
  for update to authenticated
  using (public.is_staff() and assignee_id = auth.uid())
  with check (public.is_staff() and assignee_id = auth.uid());