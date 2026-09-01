-- Remove the temporary "testing" public-read policies so admin-only aggregates
-- (projects, services, profiles) are not readable by anon/client roles.
-- Own-row reads are still covered by:
--   "Users can view own profile" (profiles, auth.uid() = id)
-- and super-admin reads by "Admins can view all profiles/projects".
drop policy if exists "Public can view all profiles (temporary for testing)" on public.profiles;
drop policy if exists "Public can view all projects (temporary for testing)" on public.projects;