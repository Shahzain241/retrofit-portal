/**
 * Profile.jsx password-change verification.
 *
 * Verifies the password-change wiring added to Profile.jsx:
 *
 *   PART A — component source checks (Profile.jsx)
 *     The component is ESM JSX and can't be imported into a plain Node script,
 *     so the render + client-side validation behavior is verified against the
 *     shipped source:
 *       a1) the password form renders New Password + Confirm New Password
 *       a2) the form has exactly the two intended fields (no current-password
 *           input — current-password re-verification is intentionally omitted)
 *       a3) validation rejects empty / too-short passwords before the call
 *       a4) validation rejects mismatched passwords before the call
 *       a5) the form submits through supabase.auth.updateUser({ password })
 *       a6) success clears the form and shows a success toast
 *       a7) errors surface the Supabase error message via the toast path
 *
 *   PART B — live Supabase auth checks (auth-dependent flow)
 *     Same approach as verify-profile.cjs: create a throwaway client, then act
 *     as that client against the real project:
 *       b1) a signed-in user can change their password (updateUser success
 *           path) — the new password signs in, the old one is rejected
 *       b2) updateUser surfaces a Supabase error for a too-short password so
 *           the component's error path has a real error to show
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Cleanup: the throwaway client account is only deleted when
 * SUPABASE_MANAGEMENT_TOKEN is set; otherwise left in place.
 *
 * Usage: node backend/verify-scripts/verify-profile-password.cjs
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

async function runQuery(query) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MGMT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error(`management query failed (${resp.status}): ${await resp.text()}`);
  return resp.json();
}

// --- PART A: component source checks -----------------------------------------
const PROFILE_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'pages', 'client', 'Profile.jsx'),
  'utf8',
);
const idx = (needle) => PROFILE_SRC.indexOf(needle);

function partA() {
  console.log('\n--- PART A: Profile.jsx password form (source checks) ---');

  const a1 = idx('onSubmit={handlePasswordChange}') >= 0 &&
    idx('profile-new-password') >= 0 && idx('New Password') >= 0 &&
    idx('profile-confirm-password') >= 0 && idx('Confirm New Password') >= 0;
  record(
    'a1) password form renders New Password + Confirm New Password fields',
    a1,
    a1 ? '' : 'missing form / field id / label in Profile.jsx',
  );

  const a2 = !PROFILE_SRC.includes('profile-current-password') &&
    !PROFILE_SRC.includes('pwForm.current');
  record(
    'a2) form has exactly the two intended fields (no current-password input)',
    a2,
    a2 ? '' : 'current-password input still present in Profile.jsx',
  );

  const nonEmptyIdx = idx('!next || !confirm');
  const minLenIdx = idx('next.length < 6');
  const matchIdx = idx('next !== confirm');
  const updateIdx = idx('updateUser({ password: next })');
  const a3 = nonEmptyIdx >= 0 && minLenIdx >= 0 && updateIdx >= 0 &&
    nonEmptyIdx < updateIdx && minLenIdx < updateIdx;
  record(
    'a3) validation rejects empty / too-short passwords before the Supabase call',
    a3,
    a3 ? '' : `empty@${nonEmptyIdx} min@${minLenIdx} update@${updateIdx}`,
  );

  const a4 = matchIdx >= 0 && updateIdx >= 0 && matchIdx < updateIdx;
  record(
    'a4) validation rejects mismatched passwords before the Supabase call',
    a4,
    a4 ? '' : `match@${matchIdx} update@${updateIdx}`,
  );

  const a5 = PROFILE_SRC.includes('supabase.auth') && updateIdx >= 0;
  record(
    'a5) form submits through supabase.auth.updateUser({ password })',
    a5,
    a5 ? '' : 'updateUser({ password }) call not found',
  );

  const a6 = idx("setPwForm({ next: '', confirm: '' })") >= 0 &&
    idx("type: 'success'") >= 0 && idx('Password updated') >= 0;
  record(
    'a6) success path clears the form and shows a success toast',
    a6,
    a6 ? '' : 'missing clear-form / success-toast wiring',
  );

  const a7 = idx('error.message') >= 0 && idx("type: 'error'") >= 0;
  record(
    'a7) error path surfaces the Supabase error message via the toast path',
    a7,
    a7 ? '' : 'missing error-message toast wiring',
  );
}

// --- PART B: live Supabase auth checks ---------------------------------------
async function partB() {
  const stamp = Date.now().toString(36);
  const clientEmail = `pwchg-${stamp}@verify.test`;

  console.log('\n--- PART B: live Supabase updateUser flow ---');

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
  const oldPass = 'VerifyPass123!';
  const { data, error: signupErr } = await client.auth.signUp({
    email: clientEmail,
    password: oldPass,
  });
  if (signupErr || !data?.user?.id) {
    throw new Error(`throwaway client signup ${clientEmail}: ${signupErr?.message}`);
  }
  if (adminSession) {
    await admin.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });
  }
  console.log('setup: throwaway client', clientEmail, data.user.id);

  // --- b1) success path ------------------------------------------------------
  const newPass = 'NewVerifyPass123!';
  const upd = await client.auth.updateUser({ password: newPass });
  record(
    'b1) updateUser({ password }) resolves without error',
    !upd.error && !!upd.data?.user,
    upd.error ? upd.error.message : `user=${upd.data.user.email}`,
  );

  const signInNew = await createClient(URL, ANON, CLIENT_OPTIONS).auth.signInWithPassword({
    email: clientEmail,
    password: newPass,
  });
  record(
    'b1) new password signs in',
    !signInNew.error && !!signInNew.data.session,
    signInNew.error ? signInNew.error.message : `session?=${!!signInNew.data.session}`,
  );

  const signInOld = await createClient(URL, ANON, CLIENT_OPTIONS).auth.signInWithPassword({
    email: clientEmail,
    password: oldPass,
  });
  record(
    'b1) old password is rejected after the change',
    !!signInOld.error,
    signInOld.error ? signInOld.error.message : 'old password still signs in',
  );

  // --- b2) error path --------------------------------------------------------
  const badUpd = await client.auth.updateUser({ password: 'abc' });
  record(
    'b2) too-short password surfaces a Supabase error (component error path)',
    !!badUpd.error && typeof badUpd.error.message === 'string' && badUpd.error.message.length > 0,
    badUpd.error ? badUpd.error.message : 'no error returned',
  );

  // --- cleanup ---------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      await runQuery(`delete from public.profiles where email = '${clientEmail}';`);
      await runQuery(`delete from auth.users where email = '${clientEmail}';`);
      const remaining = await runQuery(
        `select email from auth.users where email = '${clientEmail}';`,
      );
      record(
        `cleanup: throwaway client deleted`,
        (remaining?.length ?? 0) === 0,
        `remaining=${remaining?.length ?? 0}`,
      );
    } catch (e) {
      record('cleanup: throwaway client deleted', false, e.message);
    }
  } else {
    console.log(`  SKIP  cleanup of throwaway client — set SUPABASE_MANAGEMENT_TOKEN to delete ${clientEmail}`);
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