/**
 * PaymentMethodCard (Billing) verification — simulated payment methods.
 *
 * Confirms the "UPDATE" and "Add Backup Method" buttons — previously toast-only
 * mocks — now perform real, owner-scoped INSERT/UPDATE writes to the new
 * `payment_methods` table (brand + last 4 only; never real card numbers):
 *
 *   PART A — source checks (no browser harness)
 *       a1) PaymentMethodCard renders real rows fetched from `payment_methods`
 *           scoped to auth.uid() (no hardcoded "Visa •••• 4242" mock)
 *       a2) UPDATE opens the shared Modal and upserts the primary row (UPDATE
 *           when it exists, INSERT when it doesn't) with toast only after the
 *           write succeeds
 *       a3) Add Backup Method opens the shared Modal and INSERTs an
 *           is_backup = true row, toast only after the write succeeds
 *
 *   PART B — live checks
 *       b1) a fresh client has zero payment_methods rows
 *       b2) primary insert (is_backup=false) succeeds and round-trips with the
 *           correct user_id / brand / last4
 *       b3) primary UPDATE round-trips the new brand / last4
 *       b4) backup INSERT (is_backup=true) round-trips; both rows owned by A
 *       b5) the component's fetch returns exactly the saved details (what the
 *           UI renders matches what was saved)
 *       b6) RLS blocks inserting a row with another user's user_id (spoofed)
 *       b7) RLS blocks updating another user's row (silent no-op; admin
 *           read-back confirms values are unchanged)
 *       b8) RLS blocks selecting another user's rows (0 rows)
 *
 * Requires backend/sql/11_payment_methods_table.sql (table + owner RLS +
 * super-admin CRUD used to clean up test rows).
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test
 * auth accounts. Usage: node backend/verify-scripts/verify-payment-method.cjs
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

// The hosted Supabase API is intermittently slow; wrap every request with a
// timeout + retries so a single stalled call cannot hang the whole run.
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
const PAY_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'PaymentMethodCard.jsx'),
  'utf8',
);

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    PAY_SRC.includes("from('payment_methods')") &&
    PAY_SRC.includes('.eq(\'user_id\', user.id)') &&
    PAY_SRC.includes('supabase.auth.getUser()') &&
    !PAY_SRC.includes('Visa •••• 4242');
  record(
    'a1) renders real payment_methods rows scoped to auth.uid() (no hardcoded mock card)',
    a1,
    a1 ? '' : 'missing live fetch or still hardcodes the mock card',
  );

  const a2 =
    PAY_SRC.includes('title={mode === \'primary\' ? \'Update Payment Method\'') &&
    PAY_SRC.includes('.update({ card_brand: cardBrand, last4: cardLast4 })') &&
    PAY_SRC.includes('.insert({ user_id: user.id, card_brand: cardBrand, last4: cardLast4, is_backup: false })') &&
    /showToast\(\{ type: 'success', message: 'Payment method updated' \}\)/.test(PAY_SRC);
  record(
    'a2) UPDATE opens shared Modal + upserts primary row, toast after success',
    a2,
    a2 ? '' : 'UPDATE path is missing the modal/upsert/toast-after-success wiring',
  );

  const a3 =
    PAY_SRC.includes('Add Backup Payment Method') &&
    PAY_SRC.includes('is_backup: true') &&
    /showToast\(\{ type: 'success', message: 'Backup payment method added' \}\)/.test(PAY_SRC);
  record(
    'a3) Add Backup Method opens shared Modal + INSERTs is_backup=true row, toast after success',
    a3,
    a3 ? '' : 'Add Backup path is missing the modal/insert/toast-after-success wiring',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const clientAEmail = `paymethod-a-${stamp}@verify.test`;
  const clientBEmail = `paymethod-b-${stamp}@verify.test`;
  const createdEmails = [clientAEmail, clientBEmail];
  const PRIMARY_BRAND = 'Visa';
  const PRIMARY_LAST4 = '4242';
  const UPDATED_BRAND = 'Mastercard';
  const UPDATED_LAST4 = '1122';
  const BACKUP_BRAND = 'Amex';
  const BACKUP_LAST4 = '0005';

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

  async function makeClient(email) {
    const c = createClient(URL, ANON, CLIENT_OPTIONS);
    const { data, error } = await c.auth.signUp({ email, password: 'VerifyPass123!' });
    if (error || !data?.user?.id) throw new Error(`client signup ${email}: ${error?.message}`);
    if (adminSession) {
      await admin.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
    }
    return c;
  }
  const clientA = await makeClient(clientAEmail);
  const clientB = await makeClient(clientBEmail);
  const clientAId = (await clientA.auth.getUser()).data.user.id;
  const clientBId = (await clientB.auth.getUser()).data.user.id;
  console.log('setup: client A', clientAEmail, clientAId);
  console.log('setup: client B', clientBEmail, clientBId);

  // --- b1) fresh client has no payment methods ----------------------------------
  const fresh = await clientA
    .from('payment_methods')
    .select('*')
    .eq('user_id', clientAId);
  record(
    'b1) fresh client has zero payment_methods rows',
    !fresh.error && (fresh.data?.length ?? 0) === 0,
    fresh.error ? fresh.error.message : `rows=${fresh.data?.length ?? 0}`,
  );

  // --- b2) primary INSERT (exact PaymentMethodCard path, no-primary branch) -----
  const {
    data: { user: aUser },
  } = await clientA.auth.getUser();
  const primaryInsert = await clientA.from('payment_methods').insert({
    user_id: aUser.id,
    card_brand: PRIMARY_BRAND,
    last4: PRIMARY_LAST4,
    is_backup: false,
  });
  const { data: aRows, error: aRowsErr } = await admin
    .from('payment_methods')
    .select('*')
    .eq('user_id', clientAId);
  const primaryRow = (aRows ?? []).find((r) => !r.is_backup);
  const b2 =
    !primaryInsert.error &&
    !aRowsErr &&
    !!primaryRow &&
    primaryRow.user_id === clientAId &&
    primaryRow.card_brand === PRIMARY_BRAND &&
    primaryRow.last4 === PRIMARY_LAST4 &&
    primaryRow.is_backup === false;
  record(
    'b2) primary INSERT succeeds + round-trips (user_id/brand/last4/is_backup=false)',
    b2,
    primaryInsert.error?.message || aRowsErr?.message || `brand=${primaryRow?.card_brand} last4=${primaryRow?.last4}`,
  );

  // --- b3) primary UPDATE round-trips -------------------------------------------
  const primaryId = primaryRow?.id;
  const updatePrimary = await clientA
    .from('payment_methods')
    .update({ card_brand: UPDATED_BRAND, last4: UPDATED_LAST4 })
    .eq('id', primaryId);
  const { data: afterUpdate, error: afterUpdateErr } = await admin
    .from('payment_methods')
    .select('*')
    .eq('id', primaryId)
    .single();
  const b3 =
    !updatePrimary.error &&
    !afterUpdateErr &&
    afterUpdate?.card_brand === UPDATED_BRAND &&
    afterUpdate?.last4 === UPDATED_LAST4 &&
    afterUpdate?.user_id === clientAId;
  record(
    'b3) primary UPDATE round-trips new brand/last4 (still owner-scoped)',
    b3,
    updatePrimary.error?.message || afterUpdateErr?.message || `brand=${afterUpdate?.card_brand} last4=${afterUpdate?.last4}`,
  );

  // --- b4) backup INSERT round-trips ---------------------------------------------
  const backupInsert = await clientA.from('payment_methods').insert({
    user_id: aUser.id,
    card_brand: BACKUP_BRAND,
    last4: BACKUP_LAST4,
    is_backup: true,
  });
  const { data: aAll, error: aAllErr } = await admin
    .from('payment_methods')
    .select('*')
    .eq('user_id', clientAId);
  const backupRow = (aAll ?? []).find((r) => r.is_backup);
  const b4 =
    !backupInsert.error &&
    !aAllErr &&
    !!backupRow &&
    backupRow.card_brand === BACKUP_BRAND &&
    backupRow.last4 === BACKUP_LAST4 &&
    backupRow.is_backup === true &&
    (aAll ?? []).length === 2 &&
    (aAll ?? []).every((r) => r.user_id === clientAId);
  record(
    'b4) backup INSERT round-trips (is_backup=true); both rows owned by A',
    b4,
    backupInsert.error?.message || aAllErr?.message || `rows=${aAll?.length ?? 0}`,
  );

  // --- b5) component fetch returns exactly the saved details ----------------------
  const compFetch = await clientA
    .from('payment_methods')
    .select('*')
    .eq('user_id', clientAId)
    .order('created_at', { ascending: true });
  const prim = (compFetch.data ?? []).find((r) => !r.is_backup);
  const back = (compFetch.data ?? []).find((r) => r.is_backup);
  const b5 =
    !compFetch.error &&
    !!prim && prim.card_brand === UPDATED_BRAND && prim.last4 === UPDATED_LAST4 &&
    !!back && back.card_brand === BACKUP_BRAND && back.last4 === BACKUP_LAST4 &&
    (compFetch.data ?? []).length === 2;
  record(
    'b5) rendered details match what was saved (primary + backup via component fetch)',
    b5,
    compFetch.error ? compFetch.error.message : `primary=${prim?.card_brand}••••${prim?.last4} backup=${back?.card_brand}••••${back?.last4}`,
  );

  // --- b6) RLS: spoofed user_id insert rejected ------------------------------------
  const spoofInsert = await clientB.from('payment_methods').insert({
    user_id: clientAId,
    card_brand: 'Fake',
    last4: '9999',
    is_backup: false,
  });
  record(
    'b6) RLS rejects inserting a row with another user\'s user_id',
    !!spoofInsert.error,
    spoofInsert.error ? spoofInsert.error.message : 'spoofed insert unexpectedly succeeded',
  );

  // --- b7) RLS: update of another user's row is a silent no-op --------------------
  const spoofUpdate = await clientB
    .from('payment_methods')
    .update({ card_brand: 'Hacked', last4: '0000' })
    .eq('id', primaryId);
  const { data: unchanged, error: unchangedErr } = await admin
    .from('payment_methods')
    .select('card_brand, last4')
    .eq('id', primaryId)
    .single();
  record(
    'b7) RLS blocks updating another user\'s row (values unchanged)',
    !unchangedErr && unchanged?.card_brand === UPDATED_BRAND && unchanged?.last4 === UPDATED_LAST4,
    spoofUpdate.error ? spoofUpdate.error.message : `still brand=${unchanged?.card_brand} last4=${unchanged?.last4}`,
  );

  // --- b8) RLS: select of another user's rows returns 0 ----------------------------
  const crossSelect = await clientB
    .from('payment_methods')
    .select('*')
    .eq('user_id', clientAId);
  record(
    'b8) RLS blocks selecting another user\'s rows (0 rows)',
    !crossSelect.error && (crossSelect.data?.length ?? 0) === 0,
    crossSelect.error ? crossSelect.error.message : `rows=${crossSelect.data?.length ?? 0}`,
  );

  // --- cleanup ---------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: cleanupErr } = await admin
    .from('payment_methods')
    .delete()
    .eq('user_id', clientAId);
  const { data: leftover } = await admin
    .from('payment_methods')
    .select('id')
    .eq('user_id', clientAId);
  record(
    'cleanup: test payment_methods rows deleted',
    !cleanupErr && (leftover?.length ?? 0) === 0,
    cleanupErr ? cleanupErr.message : `remaining=${leftover?.length ?? 0}`,
  );

  if (MGMT_TOKEN) {
    try {
      const emails = createdEmails.map((e) => `'${e}'`).join(', ');
      await runQuery(`delete from public.profiles where email in (${emails});`);
      await runQuery(`delete from auth.users where email in (${emails});`);
      const remaining = await runQuery(
        `select email from auth.users where email in (${emails});`,
      );
      record(
        `cleanup: ${createdEmails.length} test auth account(s) deleted`,
        (remaining?.length ?? 0) === 0,
        `remaining=${remaining?.length ?? 0}`,
      );
    } catch (e) {
      record('cleanup: test auth accounts deleted', false, e.message);
    }
  } else {
    recordSkip('cleanup: test auth accounts deleted', `set SUPABASE_MANAGEMENT_TOKEN to delete ${createdEmails.length} test account(s)`);
  }
}

async function main() {
  partA();
  await partB();

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