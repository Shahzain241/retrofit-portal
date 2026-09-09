-- Last-login timestamp for the admin User Directory.
--   Adds `profiles.last_login_at` (timestamptz, nullable) and a SECURITY
--   DEFINER function `record_login()` that stamps `now()` onto the calling
--   user's profile row. The anon key cannot read `auth.users`, so this is the
--   supported way to persist a sign-in timestamp into a table the frontend can
--   already read (super-admin reads all profiles).
--
--   The frontend calls `select * from record_login();` right after a
--   successful `signInWithPassword` (and on the auth-state listener so token
--   refreshes count as activity too). The User Directory then reads the plain
--   `profiles.last_login_at` column.
--
-- Apply in the Supabase SQL editor (or run this file via a management API
-- script). Idempotent — safe to re-run.

alter table public.profiles
  add column if not exists last_login_at timestamptz;

-- SECURITY DEFINER so any signed-in user can stamp their own row without the
-- (absent) "update own profile" RLS policy. Function is revoked from PUBLIC by
-- default; caller must be an authenticated user (auth.uid() is not null).
create or replace function public.record_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.profiles
     set last_login_at = now()
   where id = auth.uid();
end;
$$;

grant execute on function public.record_login() to authenticated;

-- Super-admins can already read all profiles ("Admins can view all
-- profiles/projects"); ensure the new column is visible to them. If an
-- explicit read policy lists columns it must be extended, but this project's
-- super-admin read is a broad `select` policy, so no change is required.
