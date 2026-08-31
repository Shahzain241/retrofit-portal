-- Service description for the admin ServiceForm.
--   Minimal, matches the existing services pattern (nullable text column).
--   The form's Description textarea is now controlled and persisted here.

alter table public.services
  add column if not exists description text;