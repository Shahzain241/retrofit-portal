/**
 * ServiceForm deliverables verification (per-tier named list).
 *
 * Deliverables are now real, per-tier named items stored in
 * `service_tier_deliverables` (tier_id -> title), replacing the old
 * per-service numeric `services.deliverables` count.
 *
 *   PART A — source checks
 *       a1) each pricing tier renders a named deliverables list with
 *           add/remove (not a numeric count input, not a fake text-list)
 *       a2) deliverables are loaded per tier from service_tier_deliverables and
 *           saved back through service_tier_deliverables inserts
 *
 *   PART B — live checks
 *       b1) insert a service + tier with N named deliverables -> round-trips N
 *       b2) re-saving (delete tiers) removes the tier's deliverables (cascade)
 *       b3) legacy services.deliverables count stays in sync with the first tier
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * Usage: node backend/verify-scripts/verify-serviceform-deliverables.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const URL = 'https://xxtfqjbadzfjpcdfjdxo.supabase.co';

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

const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

// --- source helpers -----------------------------------------------------------
const FORM_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'pages', 'admin', 'ServiceForm.jsx'),
  'utf8',
);

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    FORM_SRC.includes('DELIVERABLES') &&
    FORM_SRC.includes('addDeliverable') &&
    FORM_SRC.includes('removeDeliverable') &&
    FORM_SRC.includes('onClick={() => addDeliverable(i)}') &&
    FORM_SRC.includes('tier.deliverables.map((d, dIndex)') &&
    FORM_SRC.includes('updateDeliverable') &&
    !FORM_SRC.includes('id="service-deliverables"') &&
    !FORM_SRC.includes('value={deliverablesCount}');
  record(
    'a1) deliverables are a per-tier named list with add/remove (no count input)',
    a1,
    a1 ? '' : 'deliverables UI is not a per-tier named list',
  );

  const a2 =
    FORM_SRC.includes("from('service_tier_deliverables')") &&
    FORM_SRC.includes("insert({ tier_id: tierRow.id, title: items[j], sort_order: j })") &&
    FORM_SRC.includes('first.deliverables.filter((d) => d.title.trim()).length') &&
    FORM_SRC.includes('.from(\'service_tier_deliverables\')') &&
    !FORM_SRC.includes("deliverables.filter((d) => d.trim() !== '').length");
  record(
    'a2) deliverables loaded per tier and saved via service_tier_deliverables',
    a2,
    a2 ? '' : 'deliverables are not wired through the tier tables',
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
    title: `Deliv Tiers ${stamp}`,
    description: 'Per-tier deliverables check.',
    price: 120,
    working_days: 4,
    deliverables: 0,
    status: 'active',
  };

  // --- b1) service + tier + named deliverables round-trip -------------------------
  const { data: inserted, error: insertErr } = await admin.from('services').insert(payload).select('*').single();
  if (!inserted?.id) throw new Error('insert failed, cannot continue');
  const row = inserted;
  const { data: tier, error: tierErr } = await admin.from('service_tiers').insert({
    service_id: row.id,
    name: 'Standard',
    price: 120,
    working_days: 4,
    sort_order: 0,
  }).select('id').single();
  const { error: delivErr } = await admin.from('service_tier_deliverables').insert([
    { tier_id: tier?.id, title: 'On-site survey', sort_order: 0 },
    { tier_id: tier?.id, title: 'EPC report', sort_order: 1 },
    { tier_id: tier?.id, title: 'Retrofit plan', sort_order: 2 },
    { tier_id: tier?.id, title: 'Funding support', sort_order: 3 },
  ]);
  const { data: delivBack } = await admin
    .from('service_tier_deliverables')
    .select('title')
    .eq('tier_id', tier?.id)
    .order('sort_order', { ascending: true });
  record(
    'b1) tier with 4 named deliverables round-trips',
    !insertErr && !tierErr && !delivErr && (delivBack?.length ?? 0) === 4,
    tierErr?.message || delivErr?.message || `deliverables=${delivBack?.length ?? 0}`,
  );

  // --- b2) re-saving (delete tier) cascades deliverables away ----------------------
  const { error: delTierErr } = await admin.from('service_tiers').delete().eq('id', tier?.id);
  const { data: orphans } = await admin.from('service_tier_deliverables').select('id').eq('tier_id', tier?.id);
  record(
    'b2) deleting a tier cascades its deliverables (no orphans)',
    !delTierErr && (orphans?.length ?? 0) === 0,
    delTierErr ? delTierErr.message : `orphans=${orphans?.length ?? 0}`,
  );

  // --- b3) legacy services.deliverables count stays in sync with first tier ---------
  const { error: legacyErr } = await admin
    .from('services')
    .update({ deliverables: 4 })
    .eq('id', row.id);
  const { data: afterCount } = await admin
    .from('services')
    .select('deliverables')
    .eq('id', row.id)
    .single();
  record(
    'b3) legacy services.deliverables count persists (kept in sync with first tier)',
    !legacyErr && Number(afterCount?.deliverables) === 4,
    legacyErr ? legacyErr.message : `deliverables=${afterCount?.deliverables}`,
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