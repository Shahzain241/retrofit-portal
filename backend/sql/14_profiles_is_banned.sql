-- Ban flag for the admin User Directory.
--   The existing profiles.status CHECK constraint only allows 'active'/'offline',
--   so banning reuses a dedicated boolean instead of touching that constraint.
--   is_banned is purely a persisted flag for now — enforcing the ban (blocking
--   login/access) is a separate future step. RLS needs no change: the existing
--   "Super admins can update all profiles" policy already covers the new column.

alter table public.profiles
  add column if not exists is_banned boolean not null default false;