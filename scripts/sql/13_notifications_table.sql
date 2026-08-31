-- Notifications (Topbar bell) — real rows created by EXISTING app events via
-- SECURITY DEFINER triggers (no client-side notification code, no fake data):
--   * project_messages AFTER INSERT -> notify the recipient:
--       - client posts  -> one notification per staff user (coordinator/
--                          designer/assessor)
--       - staff posts   -> notify the project's client owner
--   * project_deliverables AFTER INSERT/UPDATE -> when `ready` transitions to
--       true, notify the project's client owner (once; no dup on re-updates)
-- RLS: a user can select/update (is_read) only their OWN rows; super-admins
-- get full CRUD (verify-script cleanup). Inserts are trigger-only.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  link text
);

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Super admins can manage notifications" on public.notifications;
create policy "Super admins can manage notifications" on public.notifications
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- 1) Notify on new project messages --------------------------------------------
create or replace function public.handle_new_project_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_client uuid;
begin
  select client_id into v_project_client from projects where id = new.project_id;
  if v_project_client is null then
    return new;
  end if;

  if new.sender_id = v_project_client then
    -- client posted -> notify each staff user
    insert into notifications (user_id, title, body, link)
    select id, 'New project message', new.body, '/projects/' || new.project_id
    from profiles
    where role in ('coordinator', 'designer', 'assessor');
  else
    -- staff posted -> notify the client owner
    insert into notifications (user_id, title, body, link)
    values (v_project_client, 'New project message', new.body, '/projects/' || new.project_id);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_on_project_message on public.project_messages;
create trigger notify_on_project_message
  after insert on public.project_messages
  for each row execute function public.handle_new_project_message();

-- 2) Notify when a deliverable becomes ready -----------------------------------
create or replace function public.handle_project_deliverable_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_client uuid;
begin
  if not new.ready then
    return new;
  end if;
  -- only on the transition INTO ready (insert-ready, or update false->true)
  if tg_op = 'UPDATE' and old.ready is not distinct from true then
    return new;
  end if;
  select client_id into v_project_client from projects where id = new.project_id;
  if v_project_client is null then
    return new;
  end if;
  insert into notifications (user_id, title, body, link)
  values (v_project_client, 'Deliverable ready', new.title, '/projects/' || new.project_id);
  return new;
end;
$$;

drop trigger if exists notify_on_deliverable_ready on public.project_deliverables;
create trigger notify_on_deliverable_ready
  after insert or update on public.project_deliverables
  for each row execute function public.handle_project_deliverable_ready();