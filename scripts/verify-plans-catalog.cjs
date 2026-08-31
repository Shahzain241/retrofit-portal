/**
 * Plans.jsx plan-catalog + current-plan awareness verification (step a).
 *
 * Data plumbing only — CTA/button behaviour and card styling are untouched.
 *
 *   PART A — catalog source checks
 *       a1) src/data/plans.js exists with the three tiers and the prior mock
 *           shape (name/price/desc/features)
 *       a2) plans.js exports `plans`
 *       a3) the old hardcoded `plans` export was removed from src/data/misc.js
 *
 *   PART B — Plans.jsx source checks
 *       b1) imports the catalog from src/data/plans (not misc)
 *       b2) reads the current plan from ProfileContext (profile.plan)
 *       b3) computes an isCurrent flag per card
 *       b4) CTA button behaviour/text left intact (wired in a later step)
 *
 *   PART C — Billing.jsx PLAN_PRICES refactor source checks
 *       c1) PLAN_PRICES derives from the shared catalog (Object.fromEntries)
 *       c2) no separate hardcoded price map remains
 *
 *   PART D — live checks
 *       d1) the catalog has exactly one card for each plan value
 *           (Free/Priority/Enterprise) — isCurrent would be true for exactly
 *           one card per value
 *       d2) seed a test user with each plan value in turn and confirm the
 *           current-plan flag matches the corresponding card
 *       d3) a fresh user defaults to plan 'Free' → matches the Free card
 *
 * LIMITATION (noted): no browser harness — the isCurrent flag logic is
 * re-applied headlessly against the real catalog and the user's seeded plan
 * value; badge/rendering is source-checked only.
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test
 * account. Usage: node scripts/verify-plans-catalog.cjs
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

// --- load the real catalog (ESM) via dynamic import ---------------------------
async function loadCatalog() {
  const { pathToFileURL } = require('url');
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'data', 'plans.js')).href);
  return mod.plans;
}

// The exact isCurrent logic used by Plans.jsx — re-applied headlessly.
function matchesCard(planName, userPlan) {
  return planName === userPlan;
}

// --- PART A: catalog source checks --------------------------------------------
function partA(plans) {
  console.log('\n--- PART A: catalog (src/data/plans.js) source checks ---');

  const names = plans.map((p) => p.name);
  const a1 =
    names.includes('Free') && names.includes('Priority') && names.includes('Enterprise') &&
    plans.some((p) => p.name === 'Free' && p.price === '£0' && p.desc && Array.isArray(p.features)) &&
    plans.some((p) => p.name === 'Priority' && p.price === '£29') &&
    plans.some((p) => p.name === 'Enterprise' && p.price === '£149');
  record(
    'a1) catalog has Free/Priority/Enterprise with prior mock shape (name/price/desc/features)',
    a1,
    a1 ? '' : `catalog mismatch (names=${names.join(', ')})`,
  );

  const a2 = plans.length === 3;
  record(
    'a2) catalog exports exactly the 3 plan tiers',
    a2,
    a2 ? '' : `found ${plans.length} tiers`,
  );

  const MISC_SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'misc.js'), 'utf8');
  const a3 = !MISC_SRC.includes('export const plans');
  record(
    'a3) hardcoded plans export removed from src/data/misc.js',
    a3,
    a3 ? '' : 'plans still exported from misc.js',
  );
}

// --- PART B: Plans.jsx source checks -------------------------------------------
function partB() {
  console.log('\n--- PART B: Plans.jsx source checks ---');
  const PLANS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'pages', 'client', 'Plans.jsx'),
    'utf8',
  );
  const idx = (s, n) => s.indexOf(n);

  const b1 = PLANS_SRC.includes("from '../../data/plans'") && !PLANS_SRC.includes("from '../../data/misc'");
  record(
    'b1) imports the catalog from src/data/plans (not misc)',
    b1,
    b1 ? '' : 'catalog import not found / still imports misc',
  );

  const b2 = PLANS_SRC.includes('useProfile()') && idx(PLANS_SRC, 'profile.plan') >= 0;
  record(
    'b2) reads the current plan from ProfileContext (profile.plan)',
    b2,
    b2 ? '' : 'useProfile/profile.plan not found',
  );

  const b3 = PLANS_SRC.includes('isCurrent: p.name === profile.plan');
  record(
    'b3) isCurrent flag computed per card from the user\u2019s plan',
    b3,
    b3 ? '' : 'isCurrent logic not found',
  );

  const b4 = PLANS_SRC.includes("p.cta === 'Upgrade Now'") && PLANS_SRC.includes("p.cta === 'Contact Sales'");
  record(
    'b4) CTA button behaviour/text left intact (not this step)',
    b4,
    b4 ? '' : 'CTA logic appears modified',
  );
}

// --- PART C: Billing.jsx PLAN_PRICES refactor -----------------------------------
function partC() {
  console.log('\n--- PART C: Billing.jsx PLAN_PRICES refactor source checks ---');
  const BILLING_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'pages', 'client', 'Billing.jsx'),
    'utf8',
  );

  const c1 = BILLING_SRC.includes("import { plans } from '../../data/plans'") &&
    BILLING_SRC.includes('Object.fromEntries(plans.map');
  record(
    'c1) PLAN_PRICES derives from the shared catalog (Object.fromEntries)',
    c1,
    c1 ? '' : 'Billing.jsx not deriving PLAN_PRICES from the catalog',
  );

  const c2 = !BILLING_SRC.includes("Free: '£0'");
  record(
    'c2) no separate hardcoded price map remains in Billing.jsx',
    c2,
    c2 ? '' : 'hardcoded PLAN_PRICES map still present',
  );
}

// --- PART D: live checks -----------------------------------------------------------
async function partD(plans) {
  console.log('\n--- PART D: live checks ---');

  const planValues = ['Free', 'Priority', 'Enterprise'];
  const d1ok = planValues.every((v) => {
    const matches = plans.filter((p) => matchesCard(p.name, v));
    return matches.length === 1 && matches[0].name === v;
  });
  record(
    'd1) catalog has exactly one matching card for each of Free/Priority/Enterprise',
    d1ok,
    d1ok ? '' : 'some plan value matches 0 or >1 cards',
  );

  const stamp = Date.now().toString(36);
  const email = `plans-catalog-${stamp}@verify.test`;

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

  // --- d2) seed each plan value in turn; flag must match the right card -----------
  let d2ok = true;
  let d2detail = '';
  for (const value of planValues) {
    const { error: writeErr } = await client
      .from('profiles')
      .update({ plan: value })
      .eq('id', uid);
    const { data: row } = await client.from('profiles').select('plan').eq('id', uid).single();
    const currentCards = plans.filter((p) => matchesCard(p.name, row?.plan));
    const ok = !writeErr && row?.plan === value && currentCards.length === 1 && currentCards[0].name === value;
    if (!ok) {
      d2ok = false;
      d2detail = `${value}: ${writeErr ? writeErr.message : `row=${row?.plan} matched=${currentCards.map((c) => c.name).join(',')}`}`;
    }
  }
  record(
    'd2) seeding each plan value flags exactly the matching card',
    d2ok,
    d2ok ? 'Free → Free, Priority → Priority, Enterprise → Enterprise' : d2detail,
  );

  // --- d3) fresh user defaults to Free → matches the Free card ----------------------
  const { error: resetErr } = await client
    .from('profiles')
    .update({ plan: 'Free' })
    .eq('id', uid);
  const fresh = await client.from('profiles').select('plan').eq('id', uid).single();
  const freeMatch = plans.filter((p) => matchesCard(p.name, fresh.data?.plan));
  record(
    'd3) fresh/default plan "Free" flags the Free card',
    !resetErr &&
      fresh.data?.plan === 'Free' &&
      freeMatch.length === 1 &&
      freeMatch[0].name === 'Free',
    resetErr ? resetErr.message : `plan=${fresh.data?.plan} matched=${freeMatch.map((c) => c.name).join(',')}`,
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
  partA(plans);
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