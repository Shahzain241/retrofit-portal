/**
 * Plans.jsx CTA button state verification (step b).
 *
 * Button appearance/state per card only — real upgrade/downgrade actions are a
 * later step (c); non-current buttons keep their existing toast-only behaviour.
 *
 *   PART A — Plans.jsx source checks
 *       a1) the current card's button is disabled
 *       a2) the current card's button is labelled "Current Plan"
 *       a3) non-current cards keep their existing CTA text + toast logic
 *           ("Upgrade Now" / "Contact Sales")
 *       a4) a single-current guard + Free fallback is present for unrecognised
 *           plan values
 *
 *   PART B — catalog source check
 *       b1) no card uses the static "Current Plan" cta anymore — that label
 *           only ever comes from the disabled current-card state, so at most
 *           one card can display it
 *
 *   PART C — live checks
 *       c1) seeding each of Free/Priority/Enterprise flags exactly one card as
 *           current, and it's the matching one (re-applied headlessly)
 *       c2) an unrecognised plan value falls back to Free being the single
 *           current card
 *
 * LIMITATION (noted): no browser harness — the current-plan/isCurrent logic
 * (plus the Free fallback) is re-applied against the real catalog and the
 * user's seeded plan value; rendering/disabled state is source-checked only.
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test
 * account. Usage: node scripts/verify-plans-cta.cjs
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

// The exact current-card logic used by Plans.jsx — re-applied headlessly.
function currentCards(plans, plan) {
  const currentPlan = plans.some((p) => p.name === plan) ? plan : 'Free';
  return plans.map((p) => ({ name: p.name, isCurrent: p.name === currentPlan }));
}

function currentNames(cards) {
  return cards.filter((c) => c.isCurrent).map((c) => c.name);
}

// --- PART A: Plans.jsx source checks -------------------------------------------
function partA() {
  console.log('\n--- PART A: Plans.jsx button state (source checks) ---');
  const PLANS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'pages', 'client', 'Plans.jsx'),
    'utf8',
  );

  const a1 = PLANS_SRC.includes('disabled={p.isCurrent}');
  record(
    'a1) current card\u2019s button is disabled',
    a1,
    a1 ? '' : 'disabled={p.isCurrent} not found',
  );

  const a2 = PLANS_SRC.includes("{p.isCurrent ? 'Current Plan' : p.cta}");
  record(
    'a2) current card\u2019s button labelled "Current Plan"',
    a2,
    a2 ? '' : 'current-plan label logic not found',
  );

  const a3 = PLANS_SRC.includes("p.cta === 'Upgrade Now'") &&
    PLANS_SRC.includes("p.cta === 'Contact Sales'") &&
    PLANS_SRC.includes("showToast({ type: 'success', message: 'Plan upgraded' })") &&
    PLANS_SRC.includes("showToast({ type: 'info', message: 'Our sales team will contact you' })");
  record(
    'a3) non-current cards keep existing CTA text + toast logic',
    a3,
    a3 ? '' : 'non-current CTA text/toast logic missing',
  );

  const a4 = PLANS_SRC.includes('plans.some((p) => p.name === profile.plan) ? profile.plan : \'Free\'') &&
    PLANS_SRC.includes('isCurrent: p.name === currentPlan');
  record(
    'a4) single-current guard + Free fallback for unrecognised plan values',
    a4,
    a4 ? '' : 'currentPlan guard/fallback not found',
  );
}

// --- PART B: catalog source check -------------------------------------------------
function partB(plans) {
  console.log('\n--- PART B: catalog "Current Plan" uniqueness (source check) ---');

  const b1 = plans.every((p) => p.cta !== 'Current Plan');
  record(
    'b1) no static "Current Plan" cta remains in the catalog (label only comes from the disabled current card)',
    b1,
    b1 ? '' : `card(s) still use cta "Current Plan": ${plans.filter((p) => p.cta === 'Current Plan').map((p) => p.name).join(', ')}`,
  );
}

// --- PART C: live checks -----------------------------------------------------------
async function partC(plans) {
  console.log('\n--- PART C: live checks ---');

  const stamp = Date.now().toString(36);
  const email = `plans-cta-${stamp}@verify.test`;

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

  // --- c1) each plan value flags exactly one matching current card ------------------
  let c1ok = true;
  let c1detail = '';
  for (const value of ['Free', 'Priority', 'Enterprise']) {
    const { error: writeErr } = await client.from('profiles').update({ plan: value }).eq('id', uid);
    const { data: row } = await client.from('profiles').select('plan').eq('id', uid).single();
    const cur = currentNames(currentCards(plans, row?.plan));
    const ok = !writeErr && row?.plan === value && cur.length === 1 && cur[0] === value;
    if (!ok) {
      c1ok = false;
      c1detail = `${value}: ${writeErr ? writeErr.message : `row=${row?.plan} current=[${cur.join(',')}]`}`;
    }
  }
  record(
    'c1) seeding each plan value flags exactly one current card (matching)',
    c1ok,
    c1ok ? 'Free→Free, Priority→Priority, Enterprise→Enterprise' : c1detail,
  );

  // --- c2) unrecognised plan value falls back to Free --------------------------------
  const { error: bogusErr } = await client
    .from('profiles')
    .update({ plan: 'Legacy-Ultra' })
    .eq('id', uid);
  const bogusRow = await client.from('profiles').select('plan').eq('id', uid).single();
  const cur = currentNames(currentCards(plans, bogusRow.data?.plan));
  record(
    'c2) unrecognised plan value falls back to Free as the single current card',
    !bogusErr && cur.length === 1 && cur[0] === 'Free',
    bogusErr ? bogusErr.message : `plan=${bogusRow.data?.plan} current=[${cur.join(',')}]`,
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
  partB(plans);
  await partC(plans);

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