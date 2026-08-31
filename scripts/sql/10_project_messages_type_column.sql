-- Revision requests reuse the existing project_messages thread.
--   Adds a `type` discriminator so a revision request (inserted from the
--   Task & Docs tab) is distinguishable from a normal chat message, while
--   inheriting the existing client RLS on project_messages (clients can only
--   insert messages for projects they own, sender = auth.uid()). Existing rows
--   backfill to 'message'; no RLS policies are changed.

alter table public.project_messages
  add column if not exists type text not null default 'message';