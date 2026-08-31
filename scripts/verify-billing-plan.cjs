/**
 * Billing.jsx "Current Plan" card verification (step a).
 *
 * Verifies the plan/next_billing_date data plumbing:
 *
 *   PART A — Billing.jsx source checks
 *       a1) imports useProfile and reads the plan from context
 *       a2) plan NAME comes from context (profile.plan), no hardcoded
 *           "Priority Plan" literal left in the card
 *       a3) price comes from a small local PLAN_PRICES map (Free £0 /
 *           Priority £29 / Enterprise £149), not a DB lookup
 *       a4) next-billing line only renders for non-Free plans; Free shows "—"
 *       a5) feature bullets + Upgrade/Cancel buttons left inert (step c)
 *
 *   PART B — ProfileContext.jsx source checks
 *       b1) hydrates `plan` from profiles.plan
 *       b2) hydrates `nextBillingDate` from profiles.next_billing_date
 *       b3) defaults: plan 'Free', nextBillingDate null
 *
 *   PART C — setup script source checks
 *       c1) adds profiles.plan (text, default 'Free')
 *       c2) adds profiles.next_billing_date (date, nullable)
 *
 *   PART D — live checks
 *       d0) the two columns actually exist in the DB (info_schema)
 *       d1) a fresh user's profile defaults to plan 'Free' / null date and the
 *           display logic yields "—" (no billing line)
 *       d2) set plan 'Priority' + next_billing_date via the client's own row
 *           write; confirm it round-trips (own read + super-admin read) and
 *           the display logic yields "Next billing: Oct 12, 2024"
 *       d3) reset to 'Free'/null; display logic yields "—" again
 *
 * LIMITATION (noted): full UI rendering is not exercised here (no browser
 * harness). Instead we fetch the profile row headlessly and re-apply the exact
 * display logic from Billing.jsx (formatNextBilling + the Free check) to
 * confirm the values would render as expected.
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test
 * account. Usage: node scripts/verify-billing-plan.cjs
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
  path.join(__dirname, '..', 'src', 'pages', 'client', 'Billing.jsx'),
  'utf8',
);
const CTX_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'context', 'ProfileContext.jsx'),
  'utf8',
);
const SETUP_SRC = fs.readFileSync(path.join(__dirname, 'setup-billing.cjs'), 'utf8');
const idx = (src, needle) => src.indexOf(needle);

// The exact display logic used by Billing.jsx — re-applied live.
function formatNextBilling(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function displayLine(plan, nextBillingDate) {
  const nextBilling = plan !== 'Free' ? formatNextBilling(nextBillingDate) : null;
  return nextBilling ? `Next billing: ${nextBilling}` : '—';
}

// The Current Plan card region — from the card container up to the payment card.
function planCardRegion(src) {
  const start = src.indexOf('rp-plan-card');
  if (start < 0) return '';
  const end = src.indexOf('<PaymentMethodCard', start);
  return src.slice(start, end > start ? end : start + 3000);
}

// --- PART A: Billing.jsx source checks ----------------------------------------
function partA() {
  console.log('\n--- PART A: Billing.jsx Current Plan card (source checks) ---');

  const a1 = BILLING_SRC.includes("import { useProfile } from '../../context/ProfileContext'") &&
    BILLING_SRC.includes('useProfile()') &&
    BILLING_SRC.includes('profile.plan');
  record(
    'a1) Billing.jsx reads the plan from context (useProfile → profile.plan)',
    a1,
    a1 ? '' : 'missing useProfile import/usage in Billing.jsx',
  );

  const a2 = !BILLING_SRC.includes('Priority Plan') &&
    BILLING_SRC.includes('{profile.plan} Plan');
  record(
    'a2) plan NAME comes from context, not a hardcoded literal',
    a2,
    a2 ? '' : 'hardcoded "Priority Plan" still present and/or profile.plan not rendered',
  );

  const a3 = BILLING_SRC.includes('PLAN_PRICES') &&
    BILLING_SRC.includes("Free: '£0'") &&
    BILLING_SRC.includes("Priority: '£29'") &&
    BILLING_SRC.includes("Enterprise: '£149'");
  record(
    'a3) price rendered from a local PLAN_PRICES map (Free £0 / Priority £29 / Enterprise £149)',
    a3,
    a3 ? '' : 'PLAN_PRICES map missing or incomplete',
  );

  const a4 = BILLING_SRC.includes("profile.plan !== 'Free'") &&
    BILLING_SRC.includes('nextBilling');
  record(
    'a4) next-billing line only for non-Free plans (Free shows "—")',
    a4,
    a4 ? '' : 'Free/paid next-billing branching missing',
  );

  const card = planCardRegion(BILLING_SRC);
  const a5 = card.includes('Unlimited retrofit projects') &&
    card.includes('rp-plan-upgrade') &&
    card.includes('rp-plan-cancel') &&
    !card.includes('onClick');
  record(
    'a5) feature bullets + Upgrade/Cancel buttons untouched (inert)',
    a5,
    a5 ? '' : 'plan card feature bullets and/or buttons appear modified (card has onClick or missing pieces)',
  );
}

// --- PART B: ProfileContext.jsx source checks ----------------------------------
function partB() {
  console.log('\n--- PART B: ProfileContext.jsx (source checks) ---');

  const b1 = idx(CTX_SRC, 'plan: data.plan ?? prev.plan') >= 0;
  record('b1) hydrates plan from profiles.plan', b1, b1 ? '' : 'plan hydration not found');

  const b2 = idx(CTX_SRC, 'nextBillingDate: data.next_billing_date ?? prev.nextBillingDate') >= 0;
  record(
    'b2) hydrates nextBillingDate from profiles.next_billing_date',
    b2,
    b2 ? '' : 'next_billing_date hydration not found',
  );

  const b3 = idx(CTX_SRC, "plan: 'Free',") >= 0 && idx(CTX_SRC, 'nextBillingDate: null,') >= 0;
  record(
    'b3) context defaults: plan "Free", nextBillingDate null',
    b3,
    b3 ? '' : 'default plan/nextBillingDate missing',
  );
}

// --- PART C: setup script source checks ----------------------------------------
function partC() {
  console.log('\n--- PART C: setup-billing.cjs (source checks) ---');

  const c1 = SETUP_SRC.includes("add column if not exists plan text not null default 'Free'");
  record(
    'c1) adds profiles.plan (text, default \'Free\')',
    c1,
    c1 ? '' : 'plan column DDL not found in setup script',
  );

  const c2 = SETUP_SRC.includes('add column if not exists next_billing_date date');
  record(
    'c2) adds profiles.next_billing_date (date, nullable)',
    c2,
    c2 ? '' : 'next_billing_date column DDL not found in setup script',
  );
}

// --- PART D: live checks --------------------------------------------------------
async function partD() {
  console.log('\n--- PART D: live checks ---');
  const stamp = Date.now().toString(36);
  const email = `billing-plan-${stamp}@verify.test`;

  // --- d0) columns exist in the DB ----------------------------------------------
  if (MGMT_TOKEN) {
    const rows = await runQuery(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles'
         and column_name in ('plan', 'next_billing_date');`,
    );
    const names = (rows ?? []).map((r) => r.column_name);
    record(
      'd0) profiles.plan + profiles.next_billing_date columns exist in the DB',
      names.includes('plan') && names.includes('next_billing_date'),
      `columns=${JSON.stringify(names)}`,
    );
  } else {
    recordSkip('d0) columns exist in the DB', 'set SUPABASE_MANAGEMENT_TOKEN to check schema');
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

  const client = createClient(URL, ANON, CLIENT_OPTIONS);
  const { data: signupData, error: signupErr } = await client.auth.signUp({
    email,
    password: 'VerifyPass123!',
  });
  if (signupErr || !signupData?.user?.id) throw new Error(`signup ${email}: ${signupErr?.message}`);
  if (adminSession) {
    await admin.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });
  }
  const uid = signupData.user.id;
  console.log('setup: test user', email, uid);

  // --- d1) fresh user defaults to Free --------------------------------------------
  const fresh = await client.from('profiles').select('plan, next_billing_date').eq('id', uid).single();
  const freshPlan = fresh.data?.plan ?? 'Free';
  const freshLine = displayLine(freshPlan, fresh.data?.next_billing_date ?? null);
  record(
    'd1) fresh profile defaults to plan "Free" / null date; display "—"',
    !fresh.error && freshPlan === 'Free' && freshLine === '—',
    fresh.error ? fresh.error.message : `plan=${freshPlan} next=${fresh.data?.next_billing_date} line="${freshLine}"`,
  );

  // --- d2) set Priority plan + date; round-trip + display logic --------------------
  const writeErr = await client
    .from('profiles')
    .update({ plan: 'Priority', next_billing_date: '2024-10-12' })
    .eq('id', uid);
  const ownRead = await client.from('profiles').select('plan, next_billing_date').eq('id', uid).single();
  const adminRead = await admin.from('profiles').select('plan, next_billing_date').eq('id', uid).single();
  const line = displayLine(ownRead.data?.plan, ownRead.data?.next_billing_date ?? null);
  record(
    'd2) plan=Priority + next_billing_date=2024-10-12 round-trips (own + super-admin read); display "Next billing: Oct 12, 2024"',
    !writeErr.error &&
      ownRead.data?.plan === 'Priority' &&
      String(ownRead.data?.next_billing_date).startsWith('2024-10-12') &&
      adminRead.data?.plan === 'Priority' &&
      line === 'Next billing: Oct 12, 2024',
    writeErr.error
      ? writeErr.error.message
      : `plan=${ownRead.data?.plan} next=${ownRead.data?.next_billing_date} line="${line}"`,
  );

  // --- d3) reset to Free / null ------------------------------------------------------
  const resetErr = await client
    .from('profiles')
    .update({ plan: 'Free', next_billing_date: null })
    .eq('id', uid);
  const afterReset = await client.from('profiles').select('plan, next_billing_date').eq('id', uid).single();
  const resetLine = displayLine(afterReset.data?.plan, afterReset.data?.next_billing_date ?? null);
  record(
    'd3) reset to plan=Free / null date restores "—" display',
    !resetErr.error &&
      afterReset.data?.plan === 'Free' &&
      afterReset.data?.next_billing_date == null &&
      resetLine === '—',
    resetErr.error ? resetErr.error.message : `plan=${afterReset.data?.plan} next=${afterReset.data?.next_billing_date} line="${resetLine}"`,
  );

  // --- cleanup ----------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      await runQuery(`delete from public.profiles where email = '${email}';`);
      await runQuery(`delete from auth.users where email = '${email}';`);
      const remaining = await runQuery(`select email from auth.users where email = '${email}';`);
      record(
        'cleanup: test account deleted',
        (remaining?.length ?? 0) === 0,
        `remaining=${remaining?.length ?? 0}`,
      );
    } catch (e) {
      record('cleanup: test account deleted', false, e.message);
    }
  } else {
    console.log(`  SKIP  cleanup of test account — set SUPABASE_MANAGEMENT_TOKEN to delete ${email}`);
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