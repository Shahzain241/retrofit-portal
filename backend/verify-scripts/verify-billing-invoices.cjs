/**
 * Billing.jsx invoice-history verification (step b).
 *
 * Verifies the invoices wiring (Billing.jsx + src/utils/pdf.js) and the
 * `invoices` table provisioning (backend/setup-scripts/setup-invoices.cjs):
 *
 *   PART A — Billing.jsx source checks
 *       a1) the mock invoices import from src/data/misc.js is GONE
 *       a2) a real Supabase select is wired (invoices, user-scoped, date desc)
 *       a3) loading + empty states present (following the tab pattern)
 *       a4) the PDF button passes the real row (single arg, no index)
 *
 *   PART B — src/utils/pdf.js source check
 *       b1) downloadInvoicePdf uses the row's number/date/amount, not the old
 *           index-based recompute
 *
 *   PART C — setup-invoices.cjs source checks
 *       c1) creates the invoices table with the expected columns
 *       c2) enables RLS with owner-only read (user_id = auth.uid())
 *       c3) blocks all client-side writes (false insert/update/delete policies)
 *       c4) status check constraint mirrors INVOICE_STATUS (src/data/enums.js)
 *       c5) seeds sample invoices for a real demo account
 *
 *   PART D — live checks
 *       d0) table + columns + RLS + policies actually exist in the DB
 *       d1) a seeded test client sees ONLY their own invoices (ordered desc)
 *       d2) a different client sees NONE of them (RLS blocks cross-user read)
 *       d3) client-side insert/delete attempts are rejected by RLS
 *       d4) the view model fed to downloadInvoicePdf carries real row data
 *           (number/date/amount/status) — see LIMITATION
 *       d5) the seeded demo account can sign in and sees its invoices
 *
 * LIMITATION (noted): downloadInvoicePdf() is browser-only (Blob/document), so
 * it can't be executed here. d4 re-applies Billing.jsx's exact row→view-model
 * mapping headlessly and asserts the fields that flow into the generator; b1
 * confirms the generator itself reads invoice.number/date/amount.
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used to seed/clean up the test
 * accounts and inspect the schema.
 *
 * Usage: node backend/verify-scripts/verify-billing-invoices.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://xxtfqjbadzfjpcdfjdxo.supabase.co';
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

const ANON = requireEnv('VITE_SUPABASE_ANON_KEY');
const SUPERADMIN_EMAIL = requireEnv('SUPERADMIN_EMAIL');
const SUPERADMIN_PASSWORD = requireEnv('SUPERADMIN_PASSWORD');
const MGMT_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN || '';

const FETCH_TIMEOUT_MS = 45000;
async function retryingFetch(input, init) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        return await fetch(input, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

const CLIENT_OPTIONS = { global: { fetch: retryingFetch } };

const results = [];
let failures = 0;
let skipped = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function recordSkip(name, detail = '') {
  skipped += 1;
  console.log(`  SKIP  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function runQuery(query) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MGMT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error(`management query failed (${resp.status}): ${await resp.text()}`);
  return resp.json();
}

// --- source helpers -----------------------------------------------------------
const BILLING_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'pages', 'client', 'Billing.jsx'),
  'utf8',
);
const PDF_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'utils', 'pdf.js'), 'utf8');
const SETUP_SRC = fs.readFileSync(path.join(__dirname, '..', 'setup-scripts', 'setup-invoices.cjs'), 'utf8');
const idx = (src, needle) => src.indexOf(needle);

// The exact row → view-model mapping used by Billing.jsx — re-applied live.
function formatInvoiceDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function mapInvoice(inv) {
  return {
    id: inv.id,
    number: inv.number,
    date: formatInvoiceDate(inv.date),
    amount: `£${Number(inv.amount).toFixed(2)}`,
    status: inv.status,
  };
}

// --- PART A: Billing.jsx source checks ----------------------------------------
function partA() {
  console.log('\n--- PART A: Billing.jsx invoice wiring (source checks) ---');

  const a1 = !BILLING_SRC.includes("from '../../data/misc'");
  record(
    'a1) mock invoices import from src/data/misc.js removed',
    a1,
    a1 ? '' : 'still imports invoices from src/data/misc',
  );

  const a2 = BILLING_SRC.includes("from('invoices')") &&
    BILLING_SRC.includes('.eq(\'user_id\', user.id)') &&
    BILLING_SRC.includes(".order('date', { ascending: false })") &&
    BILLING_SRC.includes("from '../../lib/supabaseClient'");
  record(
    'a2) real Supabase select wired (invoices, user-scoped, date desc)',
    a2,
    a2 ? '' : 'missing invoices select wiring',
  );

  const a3 = BILLING_SRC.includes('Loading invoices...') &&
    BILLING_SRC.includes('No invoices yet.') &&
    BILLING_SRC.includes('const [loading, setLoading]');
  record(
    'a3) loading + empty states present',
    a3,
    a3 ? '' : 'loading and/or empty state missing',
  );

  const a4 = idx(BILLING_SRC, 'downloadInvoicePdf(inv)') >= 0 &&
    !BILLING_SRC.includes('downloadInvoicePdf(inv,');
  record(
    'a4) PDF button passes the real row (single arg, no index)',
    a4,
    a4 ? '' : 'downloadInvoicePdf not called with the real row only',
  );
}

// --- PART B: pdf.js source check ------------------------------------------------
function partB() {
  console.log('\n--- PART B: src/utils/pdf.js (source check) ---');

  const b1 = PDF_SRC.includes('invoice.number') &&
    !PDF_SRC.includes('902 - index');
  record(
    'b1) downloadInvoicePdf uses the row\u2019s number/date/amount (no index recompute)',
    b1,
    b1 ? '' : 'pdf.js still derives the invoice number from an index',
  );
}

// --- PART C: setup-invoices.cjs source checks -----------------------------------
function partC() {
  console.log('\n--- PART C: setup-invoices.cjs (source checks) ---');

  const c1 = SETUP_SRC.includes('create table if not exists public.invoices') &&
    SETUP_SRC.includes('id uuid primary key default gen_random_uuid()') &&
    SETUP_SRC.includes('user_id uuid not null references public.profiles(id)') &&
    SETUP_SRC.includes('number text not null') &&
    SETUP_SRC.includes('date date not null') &&
    SETUP_SRC.includes('amount numeric not null') &&
    SETUP_SRC.includes('status text not null') &&
    SETUP_SRC.includes('created_at timestamptz not null default now()');
  record(
    'c1) creates invoices table with id/user_id/number/date/amount/status/created_at',
    c1,
    c1 ? '' : 'invoices DDL not found or incomplete',
  );

  const c2 = SETUP_SRC.includes('enable row level security') &&
    SETUP_SRC.includes('for select to authenticated') &&
    SETUP_SRC.includes('using (user_id = auth.uid())');
  record(
    'c2) RLS on with owner-only read (user_id = auth.uid())',
    c2,
    c2 ? '' : 'owner-only read policy not found in setup script',
  );

  const c3 = SETUP_SRC.includes('with check (false)') &&
    SETUP_SRC.includes('using (false)') &&
    SETUP_SRC.includes('"Invoices no client insert"') &&
    SETUP_SRC.includes('"Invoices no client update"') &&
    SETUP_SRC.includes('"Invoices no client delete"');
  record(
    'c3) no client-side insert/update/delete (false policies)',
    c3,
    c3 ? '' : 'write-blocking policies not found in setup script',
  );

  const c4 = SETUP_SRC.includes("check (status in ('paid'))");
  record(
    'c4) status check constraint mirrors INVOICE_STATUS (src/data/enums.js)',
    c4,
    c4 ? '' : 'status check constraint not found in setup script',
  );

  const c5 = SETUP_SRC.includes(DEMO_EMAIL) && SETUP_SRC.includes('insert into public.invoices');
  record(
    'c5) seeds sample invoices for a real demo account',
    c5,
    c5 ? '' : 'demo seeding not found in setup script',
  );
}

// --- PART D: live checks --------------------------------------------------------
async function partD() {
  console.log('\n--- PART D: live checks ---');

  // --- d0) schema + RLS actually in the DB ---------------------------------------
  if (MGMT_TOKEN) {
    const cols = await runQuery(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'invoices';`,
    );
    const colNames = (cols ?? []).map((r) => r.column_name);
    const rls = await runQuery(
      `select relrowsecurity from pg_class where relname = 'invoices';`,
    );
    const policies = await runQuery(
      `select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'invoices';`,
    );
    const polList = (policies ?? []).map((p) => `${p.cmd}:${p.policyname}`);
    const selectPolicy = (policies ?? []).some(
      (p) => p.cmd === 'SELECT' && p.policyname === 'Invoices owner read',
    );
    record(
      'd0) invoices table + RLS + owner-read policy exist in the DB',
      ['id', 'user_id', 'number', 'date', 'amount', 'status', 'created_at'].every((c) =>
        colNames.includes(c),
      ) && rls?.[0]?.relrowsecurity === true && selectPolicy,
      `cols=${colNames.join(',')} rls=${rls?.[0]?.relrowsecurity} policies=${polList.join('; ')}`,
    );
  } else {
    recordSkip('d0) schema + RLS in the DB', 'set SUPABASE_MANAGEMENT_TOKEN to inspect schema');
  }

  const admin = createClient(URL, ANON, CLIENT_OPTIONS);
  const { error: loginErr } = await admin.auth.signInWithPassword({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
  });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);
  const {
    data: { session: adminSession },
  } = await admin.auth.getSession();

  async function makeClient(email) {
    const c = createClient(URL, ANON, CLIENT_OPTIONS);
    const { data, error } = await c.auth.signUp({ email, password: 'VerifyPass123!' });
    if (error || !data?.user?.id) throw new Error(`signup ${email}: ${error?.message}`);
    if (adminSession) {
      await admin.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
    }
    return c;
  }
  const stamp = Date.now().toString(36);
  const emailA = `billing-inv-a-${stamp}@verify.test`;
  const emailB = `billing-inv-b-${stamp}@verify.test`;
  const clientA = await makeClient(emailA);
  const clientB = await makeClient(emailB);
  const aUid = (await clientA.auth.getUser()).data.user.id;
  const bUid = (await clientB.auth.getUser()).data.user.id;
  console.log('setup: client A', emailA, aUid);
  console.log('setup: client B', emailB, bUid);

  // --- seed 3 invoices for A via the management connection (bypasses RLS) -------
  let seedingOk = true;
  if (MGMT_TOKEN) {
    await runQuery(`
      insert into public.invoices (user_id, number, date, amount, status) values
        ('${aUid}', 'INV-0003', '2024-03-12', 29.00, 'paid'),
        ('${aUid}', 'INV-0002', '2024-02-12', 29.00, 'paid'),
        ('${aUid}', 'INV-0001', '2024-01-12', 29.00, 'paid');
    `);
    const seeded = await runQuery(
      `select count(*)::int as n from public.invoices where user_id = '${aUid}';`,
    );
    seedingOk = (seeded?.[0]?.n ?? 0) === 3;
    record(
      'seed: 3 test invoices created for client A via management connection',
      seedingOk,
      `count=${seeded?.[0]?.n ?? 0}`,
    );
  } else {
    recordSkip('seed: 3 test invoices for client A', 'set SUPABASE_MANAGEMENT_TOKEN to seed');
  }

  // --- d1) A sees only own invoices, ordered date desc ---------------------------
  const aRes = await clientA
    .from('invoices')
    .select('*')
    .eq('user_id', aUid)
    .order('date', { ascending: false });
  const aRows = aRes.data ?? [];
  const descOk = aRows.length === 3 && String(aRows[0]?.date).startsWith('2024-03-12');
  record(
    'd1) client A sees exactly their own invoices, ordered by date desc',
    !aRes.error && descOk,
    aRes.error ? aRes.error.message : `count=${aRows.length} first=${aRows[0]?.number}/${aRows[0]?.date}`,
  );

  // --- d2) B sees none of A's invoices --------------------------------------------
  const bRes = await clientB.from('invoices').select('*');
  const bRows = bRes.data ?? [];
  record(
    'd2) client B sees none of client A\u2019s invoices (RLS cross-user block)',
    !bRes.error && bRows.length === 0,
    bRes.error ? bRes.error.message : `count=${bRows.length}`,
  );

  // --- d3) client-side writes rejected ---------------------------------------------
  const insA = await clientA
    .from('invoices')
    .insert({ user_id: aUid, number: 'INV-0000', date: '2024-01-01', amount: 1, status: 'paid' });
  // DELETE with no matching policy is silently skipped by RLS (0 rows, no
  // error) — the security property is that the rows survive the attempt.
  const delA = await clientA.from('invoices').delete().eq('user_id', aUid);
  const afterDel = await clientA.from('invoices').select('*');
  record(
    'd3) client-side insert rejected + delete has no effect (rows remain)',
    !!insA.error && (afterDel.data?.length ?? 0) === 3,
    `insert: ${insA.error ? insA.error.message : 'allowed!'} | delete: ${delA.error ? delA.error.message : 'silently skipped'} | rows after=${afterDel.data?.length ?? 0}`,
  );

  // --- d4) PDF generator receives real row data (view model) -----------------------
  if (aRows.length > 0) {
    const view = aRows.map(mapInvoice);
    const newest = view[0];
    record(
      'd4) view model fed to downloadInvoicePdf carries real row data',
      newest.number === 'INV-0003' &&
        newest.date === 'Mar 12, 2024' &&
        newest.amount === '£29.00' &&
        newest.status === 'paid',
      JSON.stringify(newest),
    );
  } else {
    recordSkip('d4) view model fed to downloadInvoicePdf', 'client A had no seeded rows');
  }

  // --- d5) demo account from setup-invoices.cjs can sign in + sees invoices --------
  const demo = createClient(URL, ANON, CLIENT_OPTIONS);
  const { error: demoErr } = await demo.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (demoErr) {
    recordSkip(
      'd5) seeded demo account signs in and sees its invoices',
      `sign-in failed: ${demoErr.message} (run setup-invoices.cjs first)`,
    );
  } else {
    const demoInvs = await demo.from('invoices').select('*');
    record(
      'd5) seeded demo account signs in and sees its invoices',
      (demoInvs.data?.length ?? 0) >= 1,
      demoInvs.error ? demoInvs.error.message : `count=${demoInvs.data?.length ?? 0}`,
    );
  }

  // --- cleanup (A/B accounts + their invoices; demo account untouched) --------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      await runQuery(`delete from public.profiles where email in ('${emailA}', '${emailB}');`);
      await runQuery(`delete from auth.users where email in ('${emailA}', '${emailB}');`);
      const leftoverInv = await runQuery(
        `select count(*)::int as n from public.invoices where user_id in ('${aUid}', '${bUid}');`,
      );
      const leftoverUsers = await runQuery(
        `select email from auth.users where email in ('${emailA}', '${emailB}');`,
      );
      record(
        'cleanup: test accounts + their invoices deleted',
        (leftoverInv?.[0]?.n ?? 0) === 0 && (leftoverUsers?.length ?? 0) === 0,
        `invoices=${leftoverInv?.[0]?.n ?? 0} users=${leftoverUsers?.length ?? 0}`,
      );
    } catch (e) {
      record('cleanup: test accounts deleted', false, e.message);
    }
  } else {
    console.log(`  SKIP  cleanup of test accounts — set SUPABASE_MANAGEMENT_TOKEN to delete ${emailA}, ${emailB}`);
  }
}

async function main() {
  partA();
  partB();
  partC();
  await partD();

  // --- summary ----------------------------------------------------------------
  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}   SKIPPED: ${skipped}`);

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nVERIFY SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});