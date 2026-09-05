-- Project Detail data-quality cleanup.
--
-- Run as super-admin (projects UPDATE/DELETE is super-admin only per RLS).
-- Confirmed root cause: the demo project PRJ-mtg0252k-0xvkz1 stores garbled
-- test values ("ANG", "78NPCB 67", "KLS", "2SA43", "HAND") and the assigned
-- coordinator profile has a NULL full_name. These statements replace them with
-- the approved Figma-matching values.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS reference text;

UPDATE public.projects
SET
  name = 'High-Efficiency Heat Pump Installation Cluster', -- subtitle on Project Detail
  address_line1 = '124 Oakwood Crescent',
  address_city = 'London',
  address_postcode = 'NW10 6RF',
  service = 'ECO4'                                          -- header tag badge
WHERE id = 'PRJ-mtg0252k-0xvkz1';

-- Coordinator display name (the profile Project Detail shows first).
UPDATE public.profiles
SET full_name = 'Shahzeee'
WHERE id = 'b7a2ef62-6c6c-4604-9932-2bca758d6bca';