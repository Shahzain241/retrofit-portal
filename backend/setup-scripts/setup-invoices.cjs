/**
 * One-time Supabase provisioning for the Billing invoice history.
 *
 * Creates (idempotently — safe to re-run):
 *   1) a public `invoices` table:
 *        id (uuid pk, default gen_random_uuid())
 *        user_id (uuid -> profiles(id))
 *        number (text, e.g. "INV-0001")
 *        date (date)
 *        amount (numeric)
 *        status (text — constrained to the INVOICE_STATUS set from
 *                src/data/enums.js, currently only 'paid')
 *        created_at (timestamptz, default now())
 *   2) RLS: owner-only READ (user_id = auth.uid()); NO client-side
 *      insert/update/delete — invoices are only ever created by staff/admin or
 *      a future billing system (the management connection here, which bypasses
 *      RLS). For now all client writes are blocked outright.
 *   3) seed data: a handful of sample invoice rows for a REAL demo test
 *      account (billingdemo-client@verify.test), created on demand if it does
 *      not exist — same spirit as the RET-DEMO-TIMELINE demo project. Not
 *      hardcoded across all users.
 *
 * Uses the Supabase Management API, so it requires SUPABASE_MANAGEMENT_TOKEN
 * (a personal access token starting with `sbp_`, see backend/.env.example). It does
 * NOT use the anon key — the anon key cannot alter schema or seed data.
 *
 * Usage: SUPABASE_MANAGEMENT_TOKEN=sbp_... node backend/setup-scripts/setup-invoices.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const REF = 'xxtfqjbadzfjpcdfjdxo';
const DEMO_EMAIL = 'billingdemo-client@verify.test';
const DEMO_PASSWORD = 'DemoPass123!';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable ${name}. See backend/.env.example.`);
    process.exit(1);
  }
  return value;
}

const ADMIN_TOKEN = requireEnv('SUPABASE_MANAGEMENT_TOKEN');

async function runQuery(query) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error(`management query failed (${resp.status}): ${await resp.text()}`);
  return resp.json();
}

async function main() {
  console.log('--- invoice history provisioning ---');

  // 1) table (idempotent via create-table-if-not-exists) -----------------------
  const sql = `
    create table if not exists public.invoices (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.profiles(id) on delete cascade,
      number text not null,
      date date not null,
      amount numeric not null,
      status text not null default 'paid'
        check (status in ('paid')),
      created_at timestamptz not null default now()
    );

    alter table public.invoices enable row level security;

    -- owner-only read
    drop policy if exists "Invoices owner read" on public.invoices;
    create policy "Invoices owner read" on public.invoices
      for select to authenticated
      using (user_id = auth.uid());

    -- no client-side writes: invoices are created by staff/admin or a future
    -- billing system (management connection bypasses RLS)
    drop policy if exists "Invoices no client insert" on public.invoices;
    create policy "Invoices no client insert" on public.invoices
      for insert to authenticated
      with check (false);

    drop policy if exists "Invoices no client update" on public.invoices;
    create policy "Invoices no client update" on public.invoices
      for update to authenticated
      using (false);

    drop policy if exists "Invoices no client delete" on public.invoices;
    create policy "Invoices no client delete" on public.invoices
      for delete to authenticated
      using (false);
  `;
  await runQuery(sql);
  console.log('created invoices table + RLS (owner-only read, no client writes)');

  // 2) demo account (idempotent) ----------------------------------------------
  //    GoTrue signs users in via auth.identities, so a raw auth.users insert is
  //    not enough — the matching "email" identity row must exist too, and the
  //    token/change columns GoTrue scans must be '' (never NULL), otherwise
  //    sign-in fails with 500 "Database error querying schema".
  await runQuery(`
    insert into auth.users
      (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
       confirmation_token, recovery_token, email_change, email_change_token_new,
       email_change_token_current, phone_change, phone_change_token, reauthentication_token,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
    select
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      '${DEMO_EMAIL}',
      crypt('${DEMO_PASSWORD}', gen_salt('bf')),
      now(),
      '', '', '', '', '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      false,
      false
    where not exists (select 1 from auth.users where email = '${DEMO_EMAIL}');
  `);

  // Repair any pre-existing row created before this fix (NULL token columns).
  await runQuery(`
    update auth.users
    set confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change = coalesce(email_change, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change_token_current = coalesce(email_change_token_current, ''),
        phone_change = coalesce(phone_change, ''),
        phone_change_token = coalesce(phone_change_token, ''),
        reauthentication_token = coalesce(reauthentication_token, '')
    where email = '${DEMO_EMAIL}';
  `);
  const demoRows = await runQuery(`select id from auth.users where email = '${DEMO_EMAIL}' limit 1;`);
  const demoUid = demoRows?.[0]?.id;
  if (!demoUid) throw new Error('could not resolve demo account id');

  await runQuery(`
    insert into auth.identities
      (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    select
      '${demoUid}'::text,
      id,
      jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
      'email',
      now(),
      now(),
      now()
    from auth.users
    where id = '${demoUid}'
      and not exists (select 1 from auth.identities where user_id = '${demoUid}');
  `);
  console.log(`demo client ready: ${DEMO_EMAIL}`);

  // 3) seed sample invoices for the demo account if it has none -----------------
  const counts = await runQuery(`select count(*)::int as n from public.invoices where user_id = '${demoUid}';`);
  if ((counts?.[0]?.n ?? 0) === 0) {
    await runQuery(`
      insert into public.invoices (user_id, number, date, amount, status)
      values
        ('${demoUid}', 'INV-0006', '2024-09-12', 29.00, 'paid'),
        ('${demoUid}', 'INV-0005', '2024-08-12', 29.00, 'paid'),
        ('${demoUid}', 'INV-0004', '2024-07-12', 29.00, 'paid'),
        ('${demoUid}', 'INV-0003', '2024-06-12', 29.00, 'paid'),
        ('${demoUid}', 'INV-0002', '2024-05-12', 29.00, 'paid'),
        ('${demoUid}', 'INV-0001', '2024-04-12', 29.00, 'paid');
    `);
    console.log(`seeded 6 sample invoices for demo client ${DEMO_EMAIL}`);
  } else {
    console.log(`demo client already has invoices — skipping seed`);
  }

  console.log('\ndone. Billing.jsx can now read the logged-in user\'s invoices.');
}

main().catch((e) => {
  console.error('\nSETUP SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});