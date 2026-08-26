-- Tasks table matching the TaskBoard UI columns and card fields.
-- Columns: backlog, awaiting-client, assessment, design, coordination, qa, done
-- Priority: Low / Medium / High (as rendered by the board).
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'backlog',
  priority text not null default 'Medium',
  assignee_id uuid references public.profiles(id) on delete set null,
  project_id text references public.projects(id) on delete cascade,
  tags jsonb not null default '[]'::jsonb,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_status_check check (
    status in ('backlog', 'awaiting-client', 'assessment', 'design', 'coordination', 'qa', 'done')
  ),
  constraint tasks_priority_check check (priority in ('Low', 'Medium', 'High'))
);

-- Reuses the project's existing updated_at trigger helper (same as services).
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.update_updated_at_column();