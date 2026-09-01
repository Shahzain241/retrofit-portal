-- Service pricing tiers + per-tier deliverables + media for the admin
-- ServiceForm. Previously these were honestly-disabled "Coming soon"
-- placeholders (a service had a single price/working_days/deliverables count).
--
--   service_tiers            one row per pricing tier of a service
--   service_tier_deliverables named deliverables scoped to a tier (replaces
--                             the old per-service numeric `deliverables` count)
--   services.media_url        public Storage URL for the uploaded service media
--
-- The legacy services.price / working_days / deliverables columns are KEPT and
-- kept in sync with the first (default) tier so the existing admin list page
-- and client-facing catalogue keep working unchanged.
--
-- Idempotent — safe to re-run.

-- 1) pricing tiers -----------------------------------------------------------------
create table if not exists public.service_tiers (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  working_days numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- keep updated_at fresh on tier edits (reuses the existing trigger helper)
drop trigger if exists set_service_tiers_updated_at on public.service_tiers;
create trigger set_service_tiers_updated_at
before update on public.service_tiers
for each row
execute function public.update_updated_at_column();

-- 2) per-tier deliverables -----------------------------------------------------------
create table if not exists public.service_tier_deliverables (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.service_tiers(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3) service media (public URL, not a storage path) -----------------------------------
alter table public.services add column if not exists media_url text;

-- 4) RLS — mirror the super-admin-only pattern already on `services` -------------------
alter table public.service_tiers enable row level security;
alter table public.service_tier_deliverables enable row level security;

drop policy if exists "Super-admins can view all service tiers" on public.service_tiers;
create policy "Super-admins can view all service tiers"
on public.service_tiers for select to authenticated
using (public.is_super_admin());

drop policy if exists "Super-admins can insert service tiers" on public.service_tiers;
create policy "Super-admins can insert service tiers"
on public.service_tiers for insert to authenticated
with check (public.is_super_admin());

drop policy if exists "Super-admins can update service tiers" on public.service_tiers;
create policy "Super-admins can update service tiers"
on public.service_tiers for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Super-admins can delete service tiers" on public.service_tiers;
create policy "Super-admins can delete service tiers"
on public.service_tiers for delete to authenticated
using (public.is_super_admin());

drop policy if exists "Super-admins can view all service tier deliverables" on public.service_tier_deliverables;
create policy "Super-admins can view all service tier deliverables"
on public.service_tier_deliverables for select to authenticated
using (public.is_super_admin());

drop policy if exists "Super-admins can insert service tier deliverables" on public.service_tier_deliverables;
create policy "Super-admins can insert service tier deliverables"
on public.service_tier_deliverables for insert to authenticated
with check (public.is_super_admin());

drop policy if exists "Super-admins can update service tier deliverables" on public.service_tier_deliverables;
create policy "Super-admins can update service tier deliverables"
on public.service_tier_deliverables for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Super-admins can delete service tier deliverables" on public.service_tier_deliverables;
create policy "Super-admins can delete service tier deliverables"
on public.service_tier_deliverables for delete to authenticated
using (public.is_super_admin());