/**
 * InviteStaff flow verification.
 *
 * Simulates the super-admin invite flow (the exact steps InviteStaff.jsx runs):
 *   signUp(email, secure temp password) -> restore admin session via setSession
 *   -> resetPasswordForEmail(email) -> update profiles.role
 *
 * For each invitable role (coordinator/designer/assessor) it confirms:
 *   - the account was created with the correct profiles.role
 *   - the new staff member's RLS matches a normal staff account:
 *       can read own profile; cannot read other profiles / projects / services
 *
 * Cleanup: if SUPABASE_MANAGEMENT_TOKEN is set, the created accounts are
 * deleted at the end via the Management API query endpoint.
 *
 * Usage: node scripts/verify-invite-staff.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

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

const INVITABLE_ROLES = [
  { label: 'coordinator', key: 'coordinator' },
  { label: 'designer', key: 'designer' },
  { label: 'assessor', key: 'assessor' },
];

const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function generateTempPassword() {
  return crypto.randomBytes(16).toString('base64url');
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

async function main() {
  const stamp = Date.now().toString(36);
  const created = [];

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  for (const { label, key } of INVITABLE_ROLES) {
    const email = `invstaff-${key}-${stamp}@gmail.com`;
    created.push(email);
    console.log(`\n--- inviting ${label} (${email}) ---`);

    // --- simulate the exact InviteStaff.jsx steps ---
    const tempPassword = generateTempPassword();
    const {
      data: { session: adminSession },
    } = await admin.auth.getSession();
    const { data: signup, error: signupErr } = await admin.auth.signUp({ email, password: tempPassword });
    record(`[${label}] account created via signUp`, !signupErr && !!signup?.user?.id, signupErr ? signupErr.message : '');
    if (signupErr || !signup?.user?.id) continue;

    if (adminSession) {
      const { error: restoreErr } = await admin.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
      record(`[${label}] admin session restored after signUp`, !restoreErr, restoreErr ? restoreErr.message : '');
    }

    const { error: resetErr } = await admin.auth.resetPasswordForEmail(email);
    record(`[${label}] password-reset email triggered`, !resetErr, resetErr ? resetErr.message : 'accepted');

    const { error: roleErr } = await admin.from('profiles').update({ role: key }).eq('id', signup.user.id);
    record(`[${label}] profile role set to "${key}"`, !roleErr, roleErr ? roleErr.message : '');

    const { data: profile, error: profileErr } = await admin.from('profiles').select('id, email, role').eq('id', signup.user.id).single();
    record(`[${label}] profiles.role is "${key}"`, !profileErr && profile?.role === key, profileErr ? profileErr.message : `role=${profile?.role}`);

    // --- RLS checks as the new staff member ---
    const staff = createClient(URL, ANON);
    const { error: staffLoginErr } = await staff.auth.signInWithPassword({ email, password: tempPassword });
    if (staffLoginErr) {
      record(`[${label}] staff can sign in (temp password works)`, false, staffLoginErr.message);
      continue;
    }
    record(`[${label}] staff can sign in (temp password works)`, true, '');

    const ownProfile = await staff.from('profiles').select('id').eq('id', signup.user.id);
    record(`[${label}] staff can read own profile`, (ownProfile.data?.length ?? 0) === 1, `rows=${ownProfile.data?.length ?? 0}`);

    const allProfiles = await staff.from('profiles').select('id');
    record(`[${label}] staff cannot read other profiles`, (allProfiles.data?.length ?? 0) === 1, `visible rows=${allProfiles.data?.length ?? 0}`);

    const projects = await staff.from('projects').select('id');
    record(`[${label}] staff cannot read projects`, (projects.data?.length ?? 0) === 0, `rows=${projects.data?.length ?? 0}`);

    const services = await staff.from('services').select('id');
    record(`[${label}] staff cannot read services`, (services.data?.length ?? 0) === 0, `rows=${services.data?.length ?? 0}`);
  }

  // --- cleanup --------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      const emails = created.map((e) => `'${e}'`).join(', ');
      await runQuery(`delete from public.profiles where email in (${emails});`);
      await runQuery(`delete from auth.users where email in (${emails});`);
      const remaining = await runQuery(`select email from auth.users where email in (${emails});`);
      record(`cleanup: ${created.length} test account(s) deleted`, (remaining?.length ?? 0) === 0, `remaining=${remaining?.length ?? 0}`);
    } catch (e) {
      record('cleanup: test accounts deleted', false, e.message);
    }
  } else {
    console.log(`  SKIP  cleanup — set SUPABASE_MANAGEMENT_TOKEN to delete the ${created.length} created test account(s)`);
  }

  // --- summary ----------------------------------------------------------------
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