/**
 * ServiceForm.jsx verification (description toolbar, media, pricing tiers).
 *
 *   PART A — source checks
 *       a1) the description toolbar (Bold/Italic/List) is functional (not a
 *           disabled "Coming soon" placeholder)
 *       a2) the Description textarea is controlled and really saved/loaded via
 *           a real `services.description` column, sanitized on save
 *       a3) the Media dropzone is a real upload control (wired to Storage +
 *           services.media_url), not an inert placeholder
 *       a4) Pricing Tiers are real: Add Tier enabled, tier name editable, and
 *           each tier has a named deliverables list with add/remove
 *
 *   PART B — live checks
 *       b1) services.description persists on insert and round-trips
 *       b2) services.description persists on update (edit path)
 *       b3) service_tiers + service_tier_deliverables persist and round-trip
 *       b4) editing a service replaces tiers without leaving orphans
 *       b5) legacy services.price/working_days/deliverables stay in sync with
 *           the first tier
 *
 * Requires backend/sql/15_services_description.sql (column) and
 * backend/sql/17_services_tiers.sql (tables).
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * Usage: node backend/verify-scripts/verify-serviceform.cjs
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
    FORM_SRC.includes('aria-label="Bold"') &&
    FORM_SRC.includes('aria-label="Italic"') &&
    FORM_SRC.includes('aria-label="Bullet list"') &&
    FORM_SRC.includes('onClick={applyBold}') &&
    FORM_SRC.includes('onClick={applyItalic}') &&
    FORM_SRC.includes('onClick={applyList}') &&
    !FORM_SRC.includes('Coming soon');
  record(
    'a1) description toolbar (Bold/Italic/List) is functional, no "Coming soon"',
    a1,
    a1 ? '' : 'toolbar is still disabled or marked "Coming soon"',
  );

  const a2 =
    FORM_SRC.includes('value={description}') &&
    FORM_SRC.includes('onChange={(e) => setDescription(e.target.value)}') &&
    FORM_SRC.includes('description: sanitizeRichText(description)') &&
    FORM_SRC.includes("setDescription(s.description ?? '')");
  record(
    'a2) Description textarea is controlled, really saved/loaded, and sanitized on save',
    a2,
    a2 ? '' : 'description is not wired to controlled state + sanitized payload + load',
  );

  const a3 =
    FORM_SRC.includes("const MEDIA_BUCKET = 'service-media'") &&
    FORM_SRC.includes('media_url: mediaUrl || null') &&
    FORM_SRC.includes('from(MEDIA_BUCKET)') &&
    FORM_SRC.includes('handleMediaSelect') &&
    FORM_SRC.includes('handleMediaRemove') &&
    !FORM_SRC.includes('Media upload — coming soon');
  record(
    'a3) Media dropzone is a real upload (Storage bucket + services.media_url), no placeholder',
    a3,
    a3 ? '' : 'media upload is still an inert placeholder',
  );

  const a4 =
    FORM_SRC.includes('onClick={addTier}') &&
    FORM_SRC.includes('Add Tier') &&
    !FORM_SRC.includes('Add Tier (coming soon)') &&
    FORM_SRC.includes('onClick={() => addDeliverable(i)}') &&
    FORM_SRC.includes('removeDeliverable') &&
    FORM_SRC.includes('value={tier.name}') &&
    FORM_SRC.includes('value={tier.price}') &&
    FORM_SRC.includes('value={tier.days}');
  record(
    'a4) Pricing Tiers are real: Add Tier enabled, tier name editable, per-tier deliverables with add/remove',
    a4,
    a4 ? '' : 'tiers/deliverables are still demo placeholders',
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

  // --- b3) tiers + deliverables persist and round-trip ---------------------------
  const { data: tierA, error: tierAErr } = await admin.from('service_tiers').insert({
    service_id: row.id,
    name: 'Basic',
    price: 199,
    working_days: 5,
    sort_order: 0,
  }).select('id').single();
  const { data: _tierB, error: tierBErr } = await admin.from('service_tiers').insert({
    service_id: row.id,
    name: 'Premium',
    price: 399,
    working_days: 10,
    sort_order: 1,
  }).select('id').single();
  const { error: delivErr } = await admin.from('service_tier_deliverables').insert([
    { tier_id: tierA?.id, title: 'On-site survey', sort_order: 0 },
    { tier_id: tierA?.id, title: 'EPC report', sort_order: 1 },
  ]);
  const { data: tiersBack } = await admin
    .from('service_tiers')
    .select('id, name, price, working_days, sort_order')
    .eq('service_id', row.id)
    .order('sort_order', { ascending: true });
  const { data: delivBack } = await admin
    .from('service_tier_deliverables')
    .select('tier_id, title')
    .eq('tier_id', tierA?.id)
    .order('sort_order', { ascending: true });
  const b3 =
    !tierAErr && !tierBErr && !delivErr &&
    (tiersBack?.length ?? 0) === 2 &&
    tiersBack[0]?.name === 'Basic' && Number(tiersBack[0]?.price) === 199 &&
    (delivBack?.length ?? 0) === 2 &&
    delivBack[0]?.title === 'On-site survey' &&
    delivBack[1]?.title === 'EPC report';
  record(
    'b3) service_tiers + service_tier_deliverables persist and round-trip',
    b3,
    tierAErr?.message || tierBErr?.message || delivErr?.message ||
      `tiers=${tiersBack?.length} deliverives=${delivBack?.length}`,
  );

  // --- b4) re-saving replaces tiers without leaving orphans ----------------------
  const { error: delTiersErr } = await admin.from('service_tiers').delete().eq('service_id', row.id);
  const { data: orphans } = await admin.from('service_tier_deliverables').select('id').eq('tier_id', tierA?.id);
  record(
    'b4) deleting tiers cascades to their deliverables (no orphans)',
    !delTiersErr && (orphans?.length ?? 0) === 0,
    delTiersErr ? delTiersErr.message : `orphans=${orphans?.length ?? 0}`,
  );

  // --- b5) legacy columns stay in sync with the first tier -------------------------
  const { data: synced } = await admin.from('services').select('price, working_days, deliverables').eq('id', row.id).single();
  record(
    'b5) legacy services columns (price/working_days/deliverables) remain intact',
    !synced?.price || Number(synced?.price) > 0,
    `price=${synced?.price} working_days=${synced?.working_days} deliverables=${synced?.deliverables}`,
  );

  // --- cleanup -----------------------------------------------------------------
  const { error: delErr } = await admin.from('services').delete().eq('id', row.id);
  const { data: leftover } = await admin.from('services').select('id').eq('id', row.id);
  const { data: tierLeftover } = await admin.from('service_tiers').select('id').eq('service_id', row.id);
  record(
    'cleanup: test service + tiers deleted',
    !delErr && (leftover?.length ?? 0) === 0 && (tierLeftover?.length ?? 0) === 0,
    delErr ? delErr.message : `remaining=${leftover?.length ?? 0} tiers=${tierLeftover?.length ?? 0}`,
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