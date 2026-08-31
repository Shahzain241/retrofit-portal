/**
 * ServiceForm deliverables-count verification.
 *
 * The deliverables editor used to be a fake text-list: typed deliverable names
 * were never persisted (only the count column exists on `services`), and
 * editing an existing service then saving WITHOUT touching the list silently
 * clobbered the stored count to 0 (empty rows -> filtered length 0). The list
 * is now a single honest numeric "DELIVERABLES" count input, persisted to the
 * real `services.deliverables` column.
 *
 *   PART A — source checks
 *       a1) deliverables UI is a numeric count input (no per-row text list /
 *           add-deliverable / remove-deliverable)
 *       a2) the count is loaded from the row and written back in the payload
 *           (`setDeliverablesCount(Number(s.deliverables) || 0)` +
 *           `deliverables: deliverablesCount`)
 *
 *   PART B — live checks
 *       b1) insert a service with deliverables=N -> round-trips N
 *       b2) edit the service changing ONLY title -> count stays N (no clobber)
 *       b3) update the count to M -> round-trips M
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * Usage: node scripts/verify-serviceform-deliverables.cjs
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
    FORM_SRC.includes('id="service-deliverables"') &&
    FORM_SRC.includes('type="number"') &&
    FORM_SRC.includes('value={deliverablesCount}') &&
    !FORM_SRC.includes('addDeliverable') &&
    !FORM_SRC.includes('removeDeliverable') &&
    !FORM_SRC.includes('updateDeliverable') &&
    !FORM_SRC.includes('deliverables.map((d, i)');
  record(
    'a1) deliverables UI is a numeric count input (no text-list / add / remove)',
    a1,
    a1 ? '' : 'the old fake text-list is still present',
  );

  const a2 =
    FORM_SRC.includes('setDeliverablesCount(Number(s.deliverables) || 0)') &&
    FORM_SRC.includes('deliverables: deliverablesCount') &&
    !FORM_SRC.includes("deliverables.filter((d) => d.trim() !== '').length");
  record(
    'a2) count is loaded from the row and written back in the payload (no 0-clobber path)',
    a2,
    a2 ? '' : 'count is not wired through load + payload, or the filter-based clobber remains',
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
    title: `Deliv Count ${stamp}`,
    description: 'Count persistence check.',
    price: 120,
    working_days: 4,
    deliverables: 4,
    status: 'active',
  };

  // --- b1) insert with deliverables=4 round-trips --------------------------------
  const { data: inserted, error: insertErr } = await admin.from('services').insert(payload).select('*').single();
  record(
    'b1) insert with deliverables=4 round-trips',
    !insertErr && Number(inserted?.deliverables) === 4,
    insertErr ? insertErr.message : `deliverables=${inserted?.deliverables}`,
  );
  if (!inserted?.id) throw new Error('insert failed, cannot continue');
  const row = inserted;

  // --- b2) edit changing ONLY title -> count stays 4 (no clobber) ----------------
  const { error: titleOnlyErr } = await admin
    .from('services')
    .update({ title: `${payload.title} (edited)` })
    .eq('id', row.id);
  const { data: afterTitle } = await admin
    .from('services')
    .select('title, deliverables')
    .eq('id', row.id)
    .single();
  record(
    'b2) editing only the title keeps deliverables=4 (no silent 0-clobber)',
    !titleOnlyErr && Number(afterTitle?.deliverables) === 4,
    titleOnlyErr ? titleOnlyErr.message : `deliverables=${afterTitle?.deliverables}`,
  );

  // --- b3) updating the count to 2 round-trips -------------------------------------
  const { error: countUpdErr } = await admin
    .from('services')
    .update({ deliverables: 2 })
    .eq('id', row.id);
  const { data: afterCount } = await admin
    .from('services')
    .select('deliverables')
    .eq('id', row.id)
    .single();
  record(
    'b3) updating the count to 2 round-trips',
    !countUpdErr && Number(afterCount?.deliverables) === 2,
    countUpdErr ? countUpdErr.message : `deliverables=${afterCount?.deliverables}`,
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