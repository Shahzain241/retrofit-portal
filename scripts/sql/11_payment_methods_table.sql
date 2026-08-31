-- Payment methods (client Billing) — SIMULATED cards only.
--   Stores just a brand + last 4 digits the client types in (like a fake test
--   card). NEVER store real card numbers/PANs; there is no Stripe/payment
--   processor anywhere in this app and none is implied.
--   RLS: owner-only (user_id = auth.uid()) for select/insert/update/delete,
--   plus super-admin full CRUD (same is_super_admin() pattern as projects) so
--   verify scripts can seed/clean up test rows.

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_brand text not null,
  last4 text not null,
  is_backup boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.payment_methods enable row level security;

drop policy if exists "Owner can view own payment methods" on public.payment_methods;
create policy "Owner can view own payment methods" on public.payment_methods
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Owner can insert own payment methods" on public.payment_methods;
create policy "Owner can insert own payment methods" on public.payment_methods
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Owner can update own payment methods" on public.payment_methods;
create policy "Owner can update own payment methods" on public.payment_methods
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Owner can delete own payment methods" on public.payment_methods;
create policy "Owner can delete own payment methods" on public.payment_methods
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Super admins can manage payment methods" on public.payment_methods;
create policy "Super admins can manage payment methods" on public.payment_methods
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());