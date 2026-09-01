/**
 * Billing.jsx Current Plan card actions verification (step c, simulated).
 *
 * Verifies the Upgrade/Cancel button behaviour on the Current Plan card:
 *
 *   PART A — Billing.jsx Cancel wiring (source checks)
 *       a1) Cancel button only rendered when NOT on the Free plan
 *       a2) a confirmation step (shared Modal) is shown before cancelling
 *       a3) Cancel writes profiles.plan='Free' + next_billing_date=null for
 *           the current user (supabase.auth.getUser() → eq('id', user.id))
 *       a4) on success the context is refreshed (updateProfile) and a success
 *           toast is shown
 *
 *   PART B — Billing.jsx Upgrade button (source checks)
 *       b1) Upgrade navigates to /billing/plans via Link — no fake upgrade
 *           action on this page
 *
 *   PART C — live checks
 *       c1) a fresh user's profile is plan='Free' / null date (so the Cancel
 *           button is hidden — the conditional rendering is source-checked in
 *           a1 since there is no browser harness)
 *       c2) seed a paid plan (Priority + next_billing_date) and read it back
 *       c3) simulate Cancel's exact DB write and confirm the row resets to
 *           plan='Free' / next_billing_date=null
 *
 * LIMITATION (noted): no browser harness, so modal opening / toast display are
 * source-checked; the live part exercises the exact DB writes the handlers
 * perform and confirms the row state the UI would then render.
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test
 * account. Usage: node backend/verify-scripts/verify-billing-actions.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://xxtfqjbadzfjpcdfjdxo.supabase.co';
const REF = 'xxtfqjbadzfjpcdfjdxo';

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
const idx = (src, needle) => src.indexOf(needle);

// The Current Plan card region — from the card container up to the payment card.
function planCardRegion(src) {
  const start = src.indexOf('rp-plan-card');
  if (start < 0) return '';
  const end = src.indexOf('<PaymentMethodCard', start);
  return src.slice(start, end > start ? end : start + 3000);
}

// --- PART A: Cancel wiring (source checks) ------------------------------------
function partA() {
  console.log('\n--- PART A: Billing.jsx Cancel wiring (source checks) ---');
  const card = planCardRegion(BILLING_SRC);

  const a1 = card.includes('rp-plan-cancel') &&
    card.includes("profile.plan !== 'Free'");
  record(
    'a1) Cancel button only rendered when NOT on the Free plan',
    a1,
    a1 ? '' : 'Cancel button not gated on profile.plan !== "Free"',
  );

  const a2 = BILLING_SRC.includes('Modal') &&
    BILLING_SRC.includes('isOpen={cancelOpen}') &&
    BILLING_SRC.includes('title="Cancel Subscription"') &&
    card.includes('setCancelOpen(true)');
  record(
    'a2) confirmation step (shared Modal) shown before cancelling',
    a2,
    a2 ? '' : 'confirmation modal wiring missing',
  );

  const a3 = idx(BILLING_SRC, "update({ plan: 'Free', next_billing_date: null })") >= 0 &&
    idx(BILLING_SRC, "from('profiles')") >= 0 &&
    BILLING_SRC.includes("supabase.auth.getUser()") &&
    BILLING_SRC.includes(".eq('id', user.id)");
  record(
    'a3) Cancel writes plan="Free" + next_billing_date=null for the current user',
    a3,
    a3 ? '' : 'Cancel DB write missing',
  );

  const a4 = idx(BILLING_SRC, 'updateProfile({ plan: \'Free\', nextBillingDate: null })') >= 0 &&
    BILLING_SRC.includes("showToast({ type: 'success'");
  record(
    'a4) context refreshed (updateProfile) + success toast on cancel',
    a4,
    a4 ? '' : 'updateProfile and/or success toast missing',
  );
}

// --- PART B: Upgrade button (source checks) ------------------------------------
function partB() {
  console.log('\n--- PART B: Billing.jsx Upgrade button (source checks) ---');
  const card = planCardRegion(BILLING_SRC);

  const b1 = card.includes('rp-plan-upgrade') &&
    card.includes('<Link to="/billing/plans"') &&
    !BILLING_SRC.includes("showToast({ type: 'success', message: 'Plan upgraded'");
  record(
    'b1) Upgrade navigates to /billing/plans via Link (no fake upgrade here)',
    b1,
    b1 ? '' : 'Upgrade button is not a plain Link to /billing/plans (or fakes an upgrade)',
  );
}

// --- PART C: live checks ---------------------------------------------------------
async function partC() {
  console.log('\n--- PART C: live checks ---');
  const stamp = Date.now().toString(36);
  const email = `billing-actions-${stamp}@verify.test`;

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

  // --- c1) fresh user is Free (Cancel button would be hidden) ---------------------
  const fresh = await client.from('profiles').select('plan, next_billing_date').eq('id', uid).single();
  record(
    'c1) fresh user is plan="Free" / null date (Cancel hidden)',
    !fresh.error && fresh.data?.plan === 'Free' && fresh.data?.next_billing_date == null,
    fresh.error ? fresh.error.message : `plan=${fresh.data?.plan} next=${fresh.data?.next_billing_date}`,
  );

  // --- c2) seed a paid plan and read it back ----------------------------------------
  const seedErr = await client
    .from('profiles')
    .update({ plan: 'Priority', next_billing_date: '2024-11-01' })
    .eq('id', uid);
  const seeded = await client.from('profiles').select('plan, next_billing_date').eq('id', uid).single();
  record(
    'c2) paid plan seeded (Priority + 2024-11-01) round-trips',
    !seedErr.error &&
      seeded.data?.plan === 'Priority' &&
      String(seeded.data?.next_billing_date).startsWith('2024-11-01'),
    seedErr.error
      ? seedErr.error.message
      : `plan=${seeded.data?.plan} next=${seeded.data?.next_billing_date}`,
  );

  // --- c3) simulate Cancel's exact DB write --------------------------------------------
  const cancelErr = await client
    .from('profiles')
    .update({ plan: 'Free', next_billing_date: null })
    .eq('id', uid);
  const after = await client.from('profiles').select('plan, next_billing_date').eq('id', uid).single();
  const adminAfter = await admin.from('profiles').select('plan, next_billing_date').eq('id', uid).single();
  record(
    'c3) Cancel write resets to plan="Free" / null date (own + super-admin read)',
    !cancelErr.error &&
      after.data?.plan === 'Free' &&
      after.data?.next_billing_date == null &&
      adminAfter.data?.plan === 'Free',
    cancelErr.error
      ? cancelErr.error.message
      : `plan=${after.data?.plan} next=${after.data?.next_billing_date}`,
  );

  // --- cleanup ------------------------------------------------------------------------
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
    recordSkip('cleanup: test account deleted', `set SUPABASE_MANAGEMENT_TOKEN to delete ${email}`);
  }
}

async function main() {
  partA();
  partB();
  await partC();

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