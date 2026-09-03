/**
 * Client dashboard real-data verification.
 *
 * Confirms every stat card + the greeting on ClientDashboard.jsx is backed by
 * live Supabase data scoped to the logged-in client — and that the previous
 * fabricated figures ("£1,5054", "100%") are gone.
 *
 *   PART A — source checks (no browser harness)
 *       a1) the dashboard fetches the client's invoices
 *           (from('invoices').select('amount').eq('user_id', user.id))
 *       a2) the fabricated "£1,5054" funding string is gone
 *       a3) funding is formatted as proper GBP currency via toLocaleString
 *       a4) Compliance is an honest placeholder ('—'), not a fabricated '100%'
 *       a5) the greeting pulls profile.firstName + the live active count
 *       a6) stat values are computed from query results (not hardcoded)
 *
 *   PART B — live checks (real test accounts, real queries)
 *       b1) client A's dashboard project query yields the exact active and
 *           completed counts of their seeded rows (client B's row excluded)
 *       b2) client A's dashboard invoices query sums to the seeded amount and
 *           the currency format renders "£15,186.60" (comma + 2dp)
 *       b3) client B's invoice is NOT included in client A's funding sum (RLS)
 *       b4) client B cannot read client A's invoices (cross-client read)
 *       b5) the greeting first name matches the real profiles.first_name
 *       b6) Compliance renders the honest placeholder (nothing fabricated)
 *
 * Credentials come from the root .env.local (same vars as backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is required for invoice/profile seeding + cleanup.
 *
 * Usage: node backend/verify-scripts/verify-dashboard-realdata.cjs
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://xxtfqjbadzfjpcdfjdxo.supabase.co';
const REF = 'xxtfqjbadzfjpcdfjdxo';

// --- env loading (no dotenv dependency) -------------------------------------
function loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env.local'),
    path.join(__dirname, '..', '..', '.env'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const i = line.indexOf('=');
      if (i < 0) continue;
      const key = line.slice(0, i).trim();
      let value = line.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && !(key in process.env)) process.env[key] = value;
    }
  }
}
loadEnv();

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

// The hosted Supabase API is intermittently slow; wrap every request with a
// timeout + retries so a single stalled call cannot hang the whole run.
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

// Mirrors the exact selects used by ClientDashboard.jsx.
const PROJECT_COLUMNS =
  'id, name, status, progress, address_line1, address_city, address_postcode, service, has_issues, created_at, client_id, due_date, updated_at';

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
const SRC = path.join(__dirname, '..', '..', 'src');
const readSrc = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

// Mirrors the funding formatting in ClientDashboard.jsx.
function formatFunding(sum) {
  return `£${sum.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');
  const dash = readSrc('pages/client/ClientDashboard.jsx');

  const a1 =
    dash.includes(".from('invoices')") &&
    dash.includes(".select('amount')") &&
    dash.includes(".eq('user_id', user.id)");
  record(
    'a1) dashboard fetches the client invoices (invoices + select(amount) + eq(user_id, auth user))',
    a1,
    a1 ? '' : 'invoices fetch is missing or not scoped to the logged-in client',
  );

  const a2 = !dash.includes('£1,5054');
  record(
    'a2) fabricated "£1,5054" funding string removed',
    a2,
    a2 ? '' : 'the bogus funding value is still present',
  );

  const a3 =
    dash.includes("toLocaleString('en-GB'") &&
    dash.includes('minimumFractionDigits: 2') &&
    dash.includes('maximumFractionDigits: 2');
  record(
    'a3) funding formatted as GBP currency (toLocaleString en-GB, 2dp)',
    a3,
    a3 ? '' : 'funding is not formatted as proper currency',
  );

  const a4 =
    dash.includes("value: '—'") &&
    !dash.includes("value: '100%'");
  record(
    'a4) Compliance is an honest placeholder ("—"), not fabricated "100%"',
    a4,
    a4 ? '' : 'compliance still shows a fabricated value',
  );

  const a5 =
    /Good morning\s*\{profile\.firstName\}/.test(dash) &&
    dash.includes('{activeCount} active project') &&
    !dash.includes('Good morning John') &&
    !dash.includes('2 active projects');
  record(
    'a5) greeting uses real profile.firstName + live active count (no hardcoded name/number)',
    a5,
    a5 ? '' : 'greeting still hardcodes a name or count',
  );

  const a6 =
    dash.includes('mapped.filter((p) => p.status === \'active\')') &&
    dash.includes('mapped.filter((p) => p.status === \'completed\')') &&
    dash.includes('invoiceRows') &&
    dash.includes('fundingText');
  record(
    'a6) stat values computed from live query results (projects + invoices)',
    a6,
    a6 ? '' : 'a stat value is still hardcoded',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const pA1 = `RDATA-${stamp}-A1`;
  const pA2 = `RDATA-${stamp}-A2`;
  const pA3 = `RDATA-${stamp}-A3`; // completed
  const pB1 = `RDATA-${stamp}-B1`;
  const clientAEmail = `realdash-a-${stamp}@verify.test`;
  const clientBEmail = `realdash-b-${stamp}@verify.test`;
  const createdEmails = [clientAEmail, clientBEmail];
  const invoiceNumbers = [`RVINV-${stamp}-A1`, `RVINV-${stamp}-A2`, `RVINV-${stamp}-B1`];

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
    if (error || !data?.user?.id) throw new Error(`client signup ${email}: ${error?.message}`);
    if (adminSession) {
      await admin.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
    }
    return c;
  }
  const clientA = await makeClient(clientAEmail);
  const clientB = await makeClient(clientBEmail);
  const clientAId = (await clientA.auth.getUser()).data.user.id;
  const clientBId = (await clientB.auth.getUser()).data.user.id;
  console.log('setup: client A', clientAEmail, clientAId);
  console.log('setup: client B', clientBEmail, clientBId);

  // --- seed: profiles (role=client + first_name for greeting check) ----------
  if (MGMT_TOKEN) {
    try {
      await runQuery(
        `insert into public.profiles (id, email, role, first_name, last_name)
         values ('${clientAId}', '${clientAEmail}', 'client', 'Ada', 'Lovelace')
         on conflict (id) do update set role='client', first_name='Ada', last_name='Lovelace';`,
      );
      await runQuery(
        `insert into public.profiles (id, email, role, first_name, last_name)
         values ('${clientBId}', '${clientBEmail}', 'client', 'Bee', 'Bran')
         on conflict (id) do update set role='client', first_name='Bee', last_name='Bran';`,
      );
      record('seed: profiles upserted (role=client, first_name=Ada/Bee)', true);
    } catch (e) {
      record('seed: profiles upserted (role=client, first_name=Ada/Bee)', false, e.message);
    }
  } else {
    recordSkip('seed: profiles upserted (role=client, first_name=Ada/Bee)', 'SUPABASE_MANAGEMENT_TOKEN not set');
  }

  // --- seed: projects (A: 2 active + 1 completed, B: 1 active) ----------------
  const base = {
    name: 'Seed Retrofit',
    progress: 42,
    address_line1: '1 Seed Street',
    address_city: 'London',
    address_postcode: 'SW1A 1AA',
    service: 'HVAC Retrofit',
  };
  const seedOk = await Promise.all([
    admin.from('projects').insert({ ...base, id: pA1, status: 'active', client_id: clientAId }),
    admin.from('projects').insert({ ...base, id: pA2, status: 'active', client_id: clientAId }),
    admin.from('projects').insert({ ...base, id: pA3, status: 'completed', client_id: clientAId }),
    admin.from('projects').insert({ ...base, id: pB1, status: 'active', client_id: clientBId }),
  ]);
  const seedingOk = seedOk.every((r) => !r.error);
  record(
    'seed: projects created (A: 2 active + 1 completed, B: 1 active)',
    seedingOk,
    seedingOk ? '' : seedOk.map((r) => r.error?.message).filter(Boolean).join(' | '),
  );

  // --- seed: invoices via management API (no INSERT policy exists) -------------
  if (MGMT_TOKEN && seedingOk) {
    try {
      await runQuery(
        `insert into public.invoices (user_id, number, date, amount, status) values
         ('${clientAId}', '${invoiceNumbers[0]}', '2026-08-01', 15054.00, 'paid'),
         ('${clientAId}', '${invoiceNumbers[1]}', '2026-08-15', 132.60, 'paid'),
         ('${clientBId}', '${invoiceNumbers[2]}', '2026-08-02', 999.00, 'paid');`,
      );
      record('seed: invoices created (A: 15054.00 + 132.60, B: 999.00)', true);
    } catch (e) {
      record('seed: invoices created (A: 15054.00 + 132.60, B: 999.00)', false, e.message);
    }
  } else {
    recordSkip('seed: invoices created (A: 15054.00 + 132.60, B: 999.00)', 'SUPABASE_MANAGEMENT_TOKEN not set or project seeding failed');
  }

  // --- b1) dashboard project query yields exact active/completed counts -------
  const { data: rowsA, error: qErrA } = await clientA
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('client_id', clientAId)
    .order('created_at', { ascending: false });
  const activeA = (rowsA ?? []).filter((p) => p.status === 'active').length;
  const completedA = (rowsA ?? []).filter((p) => p.status === 'completed').length;
  record(
    'b1) dashboard project query → active=2, completed=1 (B row excluded)',
    !qErrA && activeA === 2 && completedA === 1 && !(rowsA ?? []).some((p) => p.id === pB1),
    qErrA ? qErrA.message : `active=${activeA} completed=${completedA}`,
  );

  // --- b2) dashboard invoices query sums to seeded total, GBP-formatted -------
  const { data: invA, error: invErrA } = await clientA
    .from('invoices')
    .select('amount')
    .eq('user_id', clientAId);
  const fundingA = (invA ?? []).reduce(
    (sum, inv) => sum + (Number.isFinite(Number(inv.amount)) ? Number(inv.amount) : 0),
    0,
  );
  const expectedTotal = 15054 + 132.6; // 15186.6
  const fundingOk =
    !invErrA && Math.abs(fundingA - expectedTotal) < 0.001 && formatFunding(fundingA) === '£15,186.60';
  record(
    'b2) funding sum = £15,186.60 (comma + 2dp, matches dashboard formatter)',
    fundingOk,
    invErrA ? invErrA.message : `sum=${fundingA} rendered=${formatFunding(fundingA)}`,
  );

  // --- b3) B's invoice excluded from A's funding (RLS) ------------------------
  record(
    'b3) client A funding excludes client B invoice (999.00)',
    !invErrA && (invA ?? []).length === 2,
    `rows=${invA?.length ?? 0}`,
  );

  // --- b4) cross-client invoice read rejected ---------------------------------
  const cross = await clientB.from('invoices').select('amount').eq('user_id', clientAId);
  record(
    'b4) client B cannot read client A invoices (RLS: 0 rows)',
    !cross.error && (cross.data ?? []).length === 0,
    cross.error ? cross.error.message : `rows=${cross.data?.length ?? 0}`,
  );

  // --- b5) greeting first name == real profiles.first_name ---------------------
  const { data: profA, error: profErrA } = await clientA
    .from('profiles')
    .select('first_name')
    .eq('id', clientAId)
    .single();
  record(
    'b5) greeting first name comes from real profiles.first_name ("Ada")',
    !profErrA && profA?.first_name === 'Ada',
    profErrA ? profErrA.message : `first_name=${profA?.first_name}`,
  );

  // --- b6) compliance renders the honest placeholder ---------------------------
  const dashSrc = readSrc('pages/client/ClientDashboard.jsx');
  const complianceOk =
    dashSrc.includes("'—'") &&
    !dashSrc.includes("'100%'");
  record(
    'b6) Compliance renders honest placeholder "—" (no fabricated %)',
    complianceOk,
    complianceOk ? '' : 'compliance still fabricated',
  );

  // --- cleanup ----------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: cleanupErr } = await admin
    .from('projects')
    .delete()
    .in('id', [pA1, pA2, pA3, pB1]);
  const { data: leftover } = await admin
    .from('projects')
    .select('id')
    .in('id', [pA1, pA2, pA3, pB1]);
  record(
    'cleanup: seeded test projects deleted',
    !cleanupErr && (leftover?.length ?? 0) === 0,
    cleanupErr ? cleanupErr.message : `remaining=${leftover?.length ?? 0}`,
  );

  if (MGMT_TOKEN) {
    try {
      const numbers = invoiceNumbers.map((n) => `'${n}'`).join(', ');
      await runQuery(`delete from public.invoices where number in (${numbers});`);
      const invLeft = await runQuery(`select number from public.invoices where number in (${numbers});`);
      record('cleanup: seeded invoices deleted', (invLeft?.length ?? 0) === 0, `remaining=${invLeft?.length ?? 0}`);

      const emails = createdEmails.map((e) => `'${e}'`).join(', ');
      await runQuery(`delete from public.profiles where email in (${emails});`);
      await runQuery(`delete from auth.users where email in (${emails});`);
      const remaining = await runQuery(`select email from auth.users where email in (${emails});`);
      record(
        `cleanup: ${createdEmails.length} test auth account(s) deleted`,
        (remaining?.length ?? 0) === 0,
        `remaining=${remaining?.length ?? 0}`,
      );
    } catch (e) {
      record('cleanup: invoices + auth accounts deleted', false, e.message);
    }
  } else {
    recordSkip('cleanup: invoices + auth accounts deleted', 'SUPABASE_MANAGEMENT_TOKEN not set');
  }
}

async function main() {
  partA();
  await partB();

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