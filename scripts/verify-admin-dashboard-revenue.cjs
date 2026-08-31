/**
 * AdminDashboard Revenue Trend verification.
 *
 * The Revenue Trend chart used to render hardcoded mock figures (12 months of
 * invented £K values) with no demo label. It now aggregates real monthly
 * totals from the `invoices` table, which required a new super-admin read-all
 * policy (scripts/sql/16_invoices_super_admin_policy.sql — applied via
 * scripts/setup-invoices-admin-policy.cjs).
 *
 *   PART A — source checks
 *       a1) AdminDashboard queries `invoices` (date+amount) and no longer
 *           imports the mock revenueTrend from misc
 *       a2) the chart shows an honest empty state when there is no revenue
 *       a3) values are formatted as pounds (no hardcoded £K domain/ticks)
 *
 *   PART B — live checks
 *       b1) a super-admin can read another user's invoices (policy works)
 *       b2) the monthly aggregation buckets invoices by month with correct sums
 *       b3) a client still cannot read another user's invoices (owner-only
 *           scope intact)
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is required here — invoices have no client-side
 * insert policy, so test rows are created/cleaned via the Management API.
 * Usage: node scripts/verify-admin-dashboard-revenue.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const URL = 'https://xxtfqjbadzfjpcdfjdxo.supabase.co';
const REF = 'xxtfqjbadzfjpcdfjdxo';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable ${name}. See .env.example.`);
    process.exit(1);
  }
  return value;
}

const ANON = requireEnv('VITE_SUPABASE_ANON_KEY');
const SUPERADMIN_EMAIL = requireEnv('SUPERADMIN_EMAIL');
const SUPERADMIN_PASSWORD = requireEnv('SUPERADMIN_PASSWORD');
const MGMT_TOKEN = requireEnv('SUPABASE_MANAGEMENT_TOKEN');

const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

const tempPassword = () => crypto.randomBytes(16).toString('base64url');

async function runQuery(query) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MGMT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error(`management query failed (${resp.status}): ${await resp.text()}`);
  return resp.json();
}

// Mirrors AdminDashboard.jsx buildRevenueTrend (12 zero-filled months).
function buildRevenueTrend(invoices, now = new Date()) {
  const months = [];
  const byKey = {};
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = { key, month: d.toLocaleString('en-US', { month: 'short' }), value: 0 };
    months.push(entry);
    byKey[key] = entry;
  }
  (invoices ?? []).forEach((inv) => {
    const d = new Date(inv.date);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = byKey[key];
    if (entry) entry.value += Number(inv.amount) || 0;
  });
  months.forEach((m) => { m.value = Math.round(m.value * 100) / 100; });
  return months;
}

// --- source helpers -----------------------------------------------------------
const DASH_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'admin', 'AdminDashboard.jsx'),
  'utf8',
);

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    DASH_SRC.includes("from('invoices')") &&
    DASH_SRC.includes(".select('date, amount')") &&
    DASH_SRC.includes('buildRevenueTrend') &&
    !DASH_SRC.includes("revenueTrend } from '../../data/misc'");
  record(
    'a1) AdminDashboard queries invoices and no longer imports the mock revenueTrend',
    a1,
    a1 ? '' : 'mock revenue data is still imported or the invoices fetch is missing',
  );

  const a2 =
    DASH_SRC.includes('revenueTotal === 0') &&
    DASH_SRC.includes('No revenue data yet');
  record(
    'a2) chart shows an honest empty state when there is no revenue',
    a2,
    a2 ? '' : 'no empty state for zero revenue',
  );

  const a3 =
    DASH_SRC.includes('tickFormatter={(v) => `£${v}`}') &&
    DASH_SRC.includes('£{payload[0].value}') &&
    !DASH_SRC.includes('£{v}K') &&
    !DASH_SRC.includes('ticks={[0, 2, 4, 6, 8, 10]}');
  record(
    'a3) values are formatted as pounds (no hardcoded £K domain/ticks)',
    a3,
    a3 ? '' : '£K formatting or the fixed domain remains',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const ownerEmail = `rev-owner-${stamp}@verify.test`;
  const otherEmail = `rev-other-${stamp}@verify.test`;
  const createdEmails = [ownerEmail, otherEmail];

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);
  const {
    data: { session: adminSession },
  } = await admin.auth.getSession();

  async function createClientUser(email) {
    const c = createClient(URL, ANON);
    const { data, error } = await c.auth.signUp({ email, password: tempPassword() });
    if (error || !data?.user?.id) throw new Error(`signup ${email}: ${error?.message}`);
    if (adminSession) {
      await admin.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
    }
    return { id: data.user.id, client: c };
  }
  const owner = await createClientUser(ownerEmail);
  const other = await createClientUser(otherEmail);
  console.log('setup: invoice owner', ownerEmail);
  console.log('setup: other client', otherEmail);

  // Insert test invoices for the owner via Management API (no client insert policy).
  const today = new Date();
  const m1 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-10`;
  const prev = new Date(today.getFullYear(), today.getMonth() - 1, 10);
  const m2 = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-10`;
  const invRows = [
    { user_id: owner.id, number: `REV-1-${stamp}`, date: m1, amount: 100.0, status: 'paid' },
    { user_id: owner.id, number: `REV-2-${stamp}`, date: m1, amount: 50.0, status: 'paid' },
    { user_id: owner.id, number: `REV-3-${stamp}`, date: m2, amount: 75.0, status: 'paid' },
  ];
  const invNumbers = invRows.map((r) => `'${r.number}'`).join(', ');
  try {
    for (const r of invRows) {
      await runQuery(
        `insert into public.invoices (user_id, number, date, amount, status)
         values ('${r.user_id}', '${r.number}', '${r.date}', ${r.amount}, '${r.status}');`,
      );
    }
  } catch (e) {
    record('seed: test invoices inserted', false, e.message);
    record('b1) super-admin can read another user\'s invoices', false, 'seeding failed');
    record('b2) monthly aggregation sums correctly', false, 'seeding failed');
    record('b3) client still cannot read another user\'s invoices', false, 'seeding failed');
  }
  record('seed: 3 test invoices inserted', true, `${m1} x2 + ${m2} x1`);

  // --- b1) super-admin can read the owner's invoices ----------------------------
  const { data: adminInvoices, error: adminErr } = await admin
    .from('invoices')
    .select('number, amount, date');
  const adminNumbers = (adminInvoices ?? []).map((i) => i.number);
  const b1 =
    !adminErr &&
    invRows.every((r) => adminNumbers.includes(r.number));
  record(
    'b1) super-admin can read another user\u2019s invoices (read-all policy works)',
    b1,
    adminErr ? adminErr.message : `admin sees ${adminNumbers.filter((n) => n.startsWith(`REV-`)).length} test invoice(s)`,
  );

  // --- b2) monthly aggregation buckets correctly ---------------------------------
  const series = buildRevenueTrend(adminInvoices ?? []);
  const thisMonth = series[series.length - 1];
  const lastMonth = series[series.length - 2];
  const b2 =
    thisMonth?.value === 150 &&
    lastMonth?.value === 75 &&
    series.filter((m) => m.value > 0).length === 2;
  record(
    'b2) monthly aggregation sums invoices into the correct month buckets (150 / 75)',
    b2,
    `this=${thisMonth?.value} last=${lastMonth?.value} nonzeroMonths=${series.filter((m) => m.value > 0).length}`,
  );

  // --- b3) a client still cannot read another user's invoices ---------------------
  const { data: otherRead, error: otherReadErr } = await other.client
    .from('invoices')
    .select('number')
    .eq('user_id', owner.id);
  record(
    'b3) client still cannot read another user\u2019s invoices (owner-only scope intact)',
    !otherReadErr && (otherRead?.length ?? 0) === 0,
    otherReadErr ? otherReadErr.message : `rows=${otherRead?.length ?? 0}`,
  );

  // --- cleanup ---------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  try {
    await runQuery(`delete from public.invoices where number in (${invNumbers});`);
    const leftover = await runQuery(`select number from public.invoices where number in (${invNumbers});`);
    record('cleanup: test invoices deleted', (leftover?.length ?? 0) === 0, `remaining=${leftover?.length ?? 0}`);
  } catch (e) {
    record('cleanup: test invoices deleted', false, e.message);
  }
  try {
    const emails = createdEmails.map((e) => `'${e}'`).join(', ');
    await runQuery(`delete from public.profiles where email in (${emails});`);
    await runQuery(`delete from auth.users where email in (${emails});`);
    const remaining = await runQuery(`select email from auth.users where email in (${emails});`);
    record('cleanup: test accounts deleted', (remaining?.length ?? 0) === 0, `remaining=${remaining?.length ?? 0}`);
  } catch (e) {
    record('cleanup: test accounts deleted', false, e.message);
  }
}

async function main() {
  partA();
  await partB();

  // --- summary -------------------------------------------------------------------
  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nVERIFY SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});