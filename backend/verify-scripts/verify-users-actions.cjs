/**
 * Users.jsx actions verification (impersonate / edit / ban).
 *
 * The three action buttons on the User Directory used to be toast-only fakes:
 *   - "Log in as user" (impersonate): now an honest DISABLED "Coming soon"
 *     control (real session switching needs Supabase admin API / Edge Functions,
 *     which this setup doesn't have — it must not pretend to work).
 *   - "Edit user": opens a real Modal and persists full_name + role via a real
 *     `profiles` UPDATE (super-admin may change any role — the existing role
 *     lockdown trigger allows it).
 *   - "Ban user": opens a confirmation Modal and persists status='banned' on
 *     the profiles row via a real UPDATE (enforcement of the ban is a separate
 *     future step, as documented).
 *
 *   PART A — source checks
 *       a1) impersonate button is disabled + "Coming soon" (no fake toast)
 *       a2) edit opens a Modal and saves via UPDATE profiles (full_name + role)
 *       a3) ban opens a confirmation Modal and persists status via UPDATE
 *       a4) no leftover fake action toasts
 *
 *   PART B — live checks
 *       b1) a super-admin edit UPDATE (full_name + role) round-trips
 *       b2) a super-admin ban UPDATE (status='banned') round-trips
 *       b3) a non-super-admin still cannot change another user's role (lockdown)
 *
 * Requires verify-role-lockdown.cjs + verify-invite-staff.cjs to still pass —
 * run them separately afterwards to confirm no regression.
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to clean up test data.
 * Usage: node backend/verify-scripts/verify-users-actions.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

const tempPassword = () => crypto.randomBytes(16).toString('base64url');

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
const USERS_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'pages', 'admin', 'Users.jsx'),
  'utf8',
);

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    USERS_SRC.includes('aria-label="Log in as user"') &&
    USERS_SRC.includes('disabled') &&
    USERS_SRC.includes('title="Coming soon"') &&
    !USERS_SRC.includes('Impersonating user');
  record(
    'a1) impersonate button is disabled "Coming soon" (no fake toast)',
    a1,
    a1 ? '' : 'impersonate still looks interactive or toasts a fake success',
  );

  const a2 =
    USERS_SRC.includes('title="Edit User"') &&
    USERS_SRC.includes("from('profiles')") &&
    USERS_SRC.includes('.update({ full_name: editName.trim(), role: editRole })') &&
    USERS_SRC.includes(".eq('id', editingUser.id)") &&
    !USERS_SRC.includes("message: 'Editing user'");
  record(
    'a2) edit opens a Modal and saves via real UPDATE profiles (full_name + role)',
    a2,
    a2 ? '' : 'edit path is missing the modal / real UPDATE',
  );

  const a3 =
    USERS_SRC.includes('title={banUser?.is_banned ? \'Unban User\' : \'Ban User\'}') &&
    USERS_SRC.includes('.update({ is_banned: next })') &&
    USERS_SRC.includes(".eq('id', banUser.id)") &&
    !USERS_SRC.includes("message: 'User banned'");
  record(
    'a3) ban opens a confirmation Modal and persists status via real UPDATE',
    a3,
    a3 ? '' : 'ban path is missing the confirmation modal / real UPDATE',
  );

  const a4 =
    !USERS_SRC.includes("message: 'Impersonating user'") &&
    !USERS_SRC.includes("message: 'Editing user'");
  record('a4) no leftover fake action toasts', a4, a4 ? '' : 'a fake toast is still present');
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const victimEmail = `uact-${stamp}@verify.test`;
  const victimPassword = tempPassword();

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  const {
    data: { session },
  } = await admin.auth.getSession();
  const { data: signupData, error: signupErr } = await admin.auth.signUp({ email: victimEmail, password: victimPassword });
  if (signupErr || !signupData?.user?.id) throw new Error(`victim signup: ${signupErr?.message}`);
  const victimId = signupData.user.id;
  if (session) {
    await admin.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  }
  console.log('setup: victim user', victimEmail, victimId);

  // --- b1) edit UPDATE (full_name + role) round-trips ------------------------------
  const editUpd = await admin
    .from('profiles')
    .update({ full_name: 'Edited Name', role: 'designer' })
    .eq('id', victimId);
  const { data: afterEdit } = await admin
    .from('profiles')
    .select('full_name, role')
    .eq('id', victimId)
    .single();
  record(
    'b1) super-admin edit UPDATE (full_name + role) round-trips',
    !editUpd.error && afterEdit?.full_name === 'Edited Name' && afterEdit?.role === 'designer',
    editUpd.error?.message || `full_name=${afterEdit?.full_name} role=${afterEdit?.role}`,
  );

  // --- b2) ban UPDATE (is_banned=true) round-trips --------------------------------
  const banUpd = await admin.from('profiles').update({ is_banned: true }).eq('id', victimId);
  const { data: afterBan } = await admin.from('profiles').select('is_banned').eq('id', victimId).single();
  record(
    'b2) super-admin ban UPDATE (is_banned=true) round-trips',
    !banUpd.error && afterBan?.is_banned === true,
    banUpd.error?.message || `is_banned=${afterBan?.is_banned}`,
  );

  // --- b3) non-super-admin still cannot change another user's role -----------------
  const other = createClient(URL, ANON);
  const { data: otherSignup, error: otherSignupErr } = await other.auth.signUp({
    email: `uact-other-${stamp}@verify.test`,
    password: victimPassword,
  });
  if (otherSignupErr || !otherSignup?.user?.id) throw new Error(`other signup: ${otherSignupErr?.message}`);
  const otherId = otherSignup.user.id;
  // Promote "other" to coordinator so they are authenticated but not super-admin.
  const { error: promoteErr } = await admin.from('profiles').update({ role: 'coordinator' }).eq('id', otherId);
  if (promoteErr) throw new Error(`promote other: ${promoteErr.message}`);
  const otherClient = createClient(URL, ANON);
  await otherClient.auth.signInWithPassword({
    email: `uact-other-${stamp}@verify.test`,
    password: victimPassword,
  });
  await otherClient.from('profiles').update({ role: 'assessor' }).eq('id', victimId);
  const { data: afterRoleLock } = await admin.from('profiles').select('role').eq('id', victimId).single();
  record(
    'b3) non-super-admin cannot change another user\'s role (lockdown intact)',
    afterRoleLock?.role === 'designer',
    `role=${afterRoleLock?.role}`,
  );

  // --- cleanup ------------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      const emails = [`'${victimEmail}'`, `'uact-other-${stamp}@verify.test'`].join(', ');
      await runQuery(`delete from public.profiles where email in (${emails});`);
      await runQuery(`delete from auth.users where email in (${emails});`);
      const remaining = await runQuery(`select email from auth.users where email in (${emails});`);
      record('cleanup: test accounts deleted', (remaining?.length ?? 0) === 0, `remaining=${remaining?.length ?? 0}`);
    } catch (e) {
      record('cleanup: test accounts deleted', false, e.message);
    }
  } else {
    console.log('  SKIP  cleanup — set SUPABASE_MANAGEMENT_TOKEN to delete created data');
  }
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