/**
 * Plans.jsx CTA action verification (step c, simulated).
 *
 * Real (simulated) click actions on non-current-plan cards:
 *
 *   PART A — Upgrade/Switch action (source checks)
 *       a1) the handler writes profiles.plan + next_billing_date for the
 *           current user (supabase.auth.getUser() → eq('id', user.id))
 *       a2) next_billing_date is one month from today in YYYY-MM-DD
 *       a3) a confirmation modal (shared Modal) precedes the write — a stray
 *           click cannot silently change the plan
 *       a4) context is refreshed (updateProfile) + a success toast is shown
 *
 *   PART B — Contact Sales (source checks)
 *       b1) Enterprise CTA opens a mailto: link instead of a toast
 *
 *   PART C — current-card unaffected (source checks)
 *       c1) the current card's disabled "Current Plan" button is untouched
 *       c2) the click handler still no-ops on the current card
 *
 *   PART D — live checks
 *       d1) a fresh Free user: simulate the exact Priority upgrade write and
 *           confirm plan + next_billing_date land correctly (date ~1 month out)
 *       d2) after the write, re-fetch the profile: the card that was "current"
 *           before (Free) is no longer current; Priority is the single current
 *           card (the UI re-renders off updated context)
 *
 * LIMITATION (noted): no browser harness — the exact DB writes the handler
 * performs are exercised and the current-card logic is re-applied headlessly;
 * modal/rendering is source-checked only.
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test
 * account. Usage: node scripts/verify-plans-actions.cjs
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
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

// --- load the real catalog (ESM) -------------------------------------------------
async function loadCatalog() {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'data', 'plans.js')).href);
  return mod.plans;
}

// Mirrors Plans.jsx exactly.
function oneMonthFromToday() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentNames(plans, plan) {
  const currentPlan = plans.some((p) => p.name === plan) ? plan : 'Free';
  return plans.filter((p) => p.name === currentPlan).map((p) => p.name);
}

// --- PART A: Upgrade/Switch action --------------------------------------------
function partA() {
  console.log('\n--- PART A: Upgrade/Switch action (source checks) ---');
  const PLANS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'pages', 'client', 'Plans.jsx'),
    'utf8',
  );
  const idx = (s, n) => s.indexOf(n);

  const a1 = idx(PLANS_SRC, 'update({') >= 0 &&
    PLANS_SRC.includes('plan: confirmPlan') &&
    PLANS_SRC.includes('next_billing_date:') &&
    PLANS_SRC.includes('supabase.auth.getUser()') &&
    PLANS_SRC.includes(".eq('id', user.id)");
  record(
    'a1) handler writes profiles.plan + next_billing_date for the current user',
    a1,
    a1 ? '' : 'plan/date write missing',
  );

  const a2 = PLANS_SRC.includes('d.setMonth(d.getMonth() + 1)') &&
    PLANS_SRC.includes("String(d.getMonth() + 1).padStart(2, '0')");
  record(
    'a2) next_billing_date = one month from today (YYYY-MM-DD)',
    a2,
    a2 ? '' : 'one-month-from-today date logic missing',
  );

  const a3 = PLANS_SRC.includes('Modal') &&
    PLANS_SRC.includes('isOpen={!!confirmPlan}') &&
    PLANS_SRC.includes('setConfirmPlan(p.name)');
  record(
    'a3) confirmation modal precedes the write (no silent plan change)',
    a3,
    a3 ? '' : 'confirmation modal wiring missing',
  );

  const a4 = idx(PLANS_SRC, 'updateProfile({ plan: confirmPlan') >= 0 &&
    PLANS_SRC.includes("showToast({ type: 'success'");
  record(
    'a4) context refreshed (updateProfile) + success toast on switch',
    a4,
    a4 ? '' : 'updateProfile and/or success toast missing',
  );
}

// --- PART B: Contact Sales ------------------------------------------------------
function partB() {
  console.log('\n--- PART B: Contact Sales (source checks) ---');
  const PLANS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'pages', 'client', 'Plans.jsx'),
    'utf8',
  );

  const b1 = PLANS_SRC.includes('SALES_LINK') &&
    PLANS_SRC.includes('mailto:') &&
    !PLANS_SRC.includes("'Our sales team will contact you'");
  record(
    'b1) Enterprise CTA opens a mailto: link (toast behaviour removed)',
    b1,
    b1 ? '' : 'mailto missing and/or old toast still present',
  );
}

// --- PART C: current-card unaffected ---------------------------------------------
function partC() {
  console.log('\n--- PART C: current-card state unaffected (source checks) ---');
  const PLANS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'pages', 'client', 'Plans.jsx'),
    'utf8',
  );

  const c1 = PLANS_SRC.includes('disabled={p.isCurrent}') &&
    PLANS_SRC.includes("{p.isCurrent ? 'Current Plan' : p.cta}");
  record(
    'c1) current card still shows a disabled "Current Plan" button',
    c1,
    c1 ? '' : 'current-card disabled state modified',
  );

  const c2 = PLANS_SRC.includes('if (p.isCurrent) return;');
  record(
    'c2) click handler still no-ops on the current card',
    c2,
    c2 ? '' : 'current-card guard removed',
  );
}

// --- PART D: live checks -----------------------------------------------------------
async function partD(plans) {
  console.log('\n--- PART D: live checks ---');
  const stamp = Date.now().toString(36);
  const email = `plans-actions-${stamp}@verify.test`;

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

  // --- baseline: fresh user is Free (the current card before the upgrade) --------
  const before = await client.from('profiles').select('plan, next_billing_date').eq('id', uid).single();
  const beforeCurrent = currentNames(plans, before.data?.plan);
  record(
    'd-prep) fresh user baseline: plan="Free" current (Free card is current)',
    !before.error && before.data?.plan === 'Free' && beforeCurrent.length === 1 && beforeCurrent[0] === 'Free',
    before.error ? before.error.message : `plan=${before.data?.plan} current=[${beforeCurrent.join(',')}]`,
  );

  // --- d1) simulate the exact Priority upgrade write -------------------------------
  const expectedDate = oneMonthFromToday();
  const upErr = await client
    .from('profiles')
    .update({ plan: 'Priority', next_billing_date: expectedDate })
    .eq('id', uid);
  const up = await client.from('profiles').select('plan, next_billing_date').eq('id', uid).single();
  const adminUp = await admin.from('profiles').select('plan, next_billing_date').eq('id', uid).single();
  const dateMatches = String(up.data?.next_billing_date).startsWith(expectedDate.slice(0, 7));
  record(
    'd1) Priority upgrade write lands: plan="Priority", next_billing_date ~1 month out',
    !upErr.error &&
      up.data?.plan === 'Priority' &&
      dateMatches &&
      adminUp.data?.plan === 'Priority',
    upErr.error
      ? upErr.error.message
      : `plan=${up.data?.plan} next=${up.data?.next_billing_date} (expected ~${expectedDate})`,
  );

  // --- d2) re-fetch: Free no longer current; Priority is the single current card ----
  const afterCurrent = currentNames(plans, up.data?.plan);
  record(
    'd2) after the write, Free is no longer current and Priority is the single current card',
    afterCurrent.length === 1 && afterCurrent[0] === 'Priority',
    `current=[${afterCurrent.join(',')}]`,
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
  const plans = await loadCatalog();
  partA();
  partB();
  partC();
  await partD(plans);

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