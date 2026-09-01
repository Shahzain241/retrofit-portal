# backend/

Supabase tooling for the Retrofit Portal — fully separate from the Vite/React
frontend (`src/`, `public/`, the root `package.json`, etc.). The frontend does
not read or run anything in this folder.

## Layout

- `sql/` — numbered SQL migrations
  (`01_create_function.sql` … `16_invoices_super_admin_policy.sql`). Apply
  them in order to the Supabase project (e.g. via the SQL editor).
- `setup-scripts/` — one-time provisioning scripts (`setup-*.cjs`) that apply
  schema/policies using the Supabase Management API.
- `verify-scripts/` — verification scripts (`verify-*.cjs`) that assert the app
  wiring and live DB state still hold.

## Environment

Copy `backend/.env.example` to `backend/.env` and fill in real values:

    cp backend/.env.example backend/.env

Scripts load `backend/.env` automatically via dotenv; values already exported
in your shell take precedence.

## Running

Run any script from the repo root with Node:

    node backend/setup-scripts/setup-avatars-bucket.cjs
    node backend/verify-scripts/verify-admin-dashboard.cjs

- The `setup-*.cjs` scripts require `SUPABASE_MANAGEMENT_TOKEN`.
- The `verify-*.cjs` scripts require `VITE_SUPABASE_ANON_KEY`,
  `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` (and optionally
  `SUPABASE_MANAGEMENT_TOKEN` to seed/clean up test data).

## Dependencies

This folder has its own `package.json` (`@supabase/supabase-js`, `dotenv`),
independent of the frontend's `package.json`. Install its deps with:

    npm install