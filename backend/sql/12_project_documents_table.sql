-- Project documents (Task & Docs tab) — real uploaded files.
--   `file_path` is a Storage path in the PRIVATE `project-documents` bucket
--   (NOT a public URL); the UI generates 60s signed URLs on demand (same as
--   Profile.jsx EPC certificates).
--   RLS mirrors project_messages:
--     clients: insert + select only rows for projects they own
--              (is_client() + project owned by auth.uid())
--     staff/super-admin: read all
--     super-admin: full CRUD (used by verify scripts to seed/clean up)

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id),
  uploaded_by uuid not null,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  uploaded_at timestamptz not null default now()
);

alter table public.project_documents enable row level security;

drop policy if exists "Clients can view own project documents" on public.project_documents;
create policy "Clients can view own project documents" on public.project_documents
  for select to authenticated
  using (public.is_client() and project_id in (select id from public.projects where client_id = auth.uid()));

drop policy if exists "Staff can view all project documents" on public.project_documents;
create policy "Staff can view all project documents" on public.project_documents
  for select to authenticated
  using (public.is_staff() or public.is_super_admin());

drop policy if exists "Clients can insert own project documents" on public.project_documents;
create policy "Clients can insert own project documents" on public.project_documents
  for insert to authenticated
  with check (public.is_client() and uploaded_by = auth.uid() and project_id in (select id from public.projects where client_id = auth.uid()));

drop policy if exists "Super admins can manage project documents" on public.project_documents;
create policy "Super admins can manage project documents" on public.project_documents
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());