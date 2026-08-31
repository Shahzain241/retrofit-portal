/**
 * ServiceForm.jsx fixes verification (tier decoupling, description, inert controls).
 *
 *   PART A — source checks
 *       a1) tier price/days have their OWN local state — editing them no longer
 *           corrupts the main price/workingDays fields
 *       a2) the Description textarea is controlled and really saved/loaded via a
 *           real `services.description` column (no silent discard)
 *       a3) decorative controls (Media dropzone, Add Tier, tier-name,
 *           Bold/Italic/List toolbar) are honestly disabled "Coming soon"
 *
 *   PART B — live checks
 *       b1) services.description persists on insert and round-trips
 *       b2) services.description persists on update (edit path)
 *
 * Requires scripts/sql/15_services_description.sql (column).
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * Usage: node scripts/verify-serviceform.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const URL = 'https://xxtfqjbadzfjpcdfjdxo.supabase.co';

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

const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

// --- source helpers -----------------------------------------------------------
const FORM_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'admin', 'ServiceForm.jsx'),
  'utf8',
);

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    FORM_SRC.includes('value={tierPrice}') &&
    FORM_SRC.includes('value={tierDays}') &&
    FORM_SRC.includes('setTierPrice') &&
    FORM_SRC.includes('setTierDays') &&
    !FORM_SRC.includes('id="tier-price" value={price}') &&
    !FORM_SRC.includes('id="tier-days" value={workingDays}') &&
    !FORM_SRC.includes('setPrice(e.target.value)} className="w-full rounded-lg');
  record(
    'a1) tier price/days use separate state (do not touch main price/workingDays)',
    a1,
    a1 ? '' : 'tier inputs are still bound to the main form state',
  );

  const a2 =
    FORM_SRC.includes('value={description}') &&
    FORM_SRC.includes('onChange={(e) => setDescription(e.target.value)}') &&
    FORM_SRC.includes('description: description.trim()') &&
    FORM_SRC.includes("setDescription(s.description ?? '')");
  record(
    'a2) Description textarea is controlled and really saved/loaded',
    a2,
    a2 ? '' : 'description is not wired to controlled state + payload + load',
  );

  const a3 =
    FORM_SRC.includes('Media upload — coming soon') &&
    FORM_SRC.includes('cursor-not-allowed') &&
    FORM_SRC.includes('Add Tier (coming soon)') &&
    FORM_SRC.includes('id="tier-name" placeholder="Coming soon"') &&
    FORM_SRC.includes('title="Coming soon"') &&
    FORM_SRC.includes('opacity-40 cursor-not-allowed');
  record(
    'a3) decorative controls honestly disabled "Coming soon" (media/Add Tier/tier-name/toolbar)',
    a3,
    a3 ? '' : 'one or more decorative controls still look clickable-but-broken',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  const payload = {
    title: `Svc Form ${stamp}`,
    description: 'A real service description.',
    price: 99,
    working_days: 3,
    deliverables: 2,
    status: 'active',
  };

  // --- b1) insert + round-trip -------------------------------------------------
  const { data: inserted, error: insertErr } = await admin.from('services').insert(payload).select('*').single();
  const row = inserted;
  record(
    'b1) services.description persists on insert and round-trips',
    !insertErr && row?.description === payload.description,
    insertErr ? insertErr.message : `description=${row?.description}`,
  );
  if (!row?.id) throw new Error('insert failed');

  // --- b2) update + round-trip -------------------------------------------------
  const { error: updateErr } = await admin
    .from('services')
    .update({ description: 'Updated description.' })
    .eq('id', row.id);
  const { data: afterUpd } = await admin.from('services').select('description').eq('id', row.id).single();
  record(
    'b2) services.description persists on update (edit path)',
    !updateErr && afterUpd?.description === 'Updated description.',
    updateErr ? updateErr.message : `description=${afterUpd?.description}`,
  );

  // --- cleanup -----------------------------------------------------------------
  const { error: delErr } = await admin.from('services').delete().eq('id', row.id);
  const { data: leftover } = await admin.from('services').select('id').eq('id', row.id);
  record(
    'cleanup: test service deleted',
    !delErr && (leftover?.length ?? 0) === 0,
    delErr ? delErr.message : `remaining=${leftover?.length ?? 0}`,
  );
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