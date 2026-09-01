/**
 * RLS role-lockdown verification for the `profiles` table.
 *
 * Confirms the fix (trigger `prevent_non_admin_role_change` + the
 * "Super admins can update all profiles" policy):
 *
 *   a) a client-role user CANNOT change their own `role` (self-promotion blocked)
 *   b) the same user CAN still update their own harmless profile fields (full_name)
 *   c) a real super-admin CAN change another user's role
 *
 * The super-admin test account is provisioned out-of-band via SQL because
 * self-escalation is now blocked by design. Credentials come from env vars
 * (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Usage: node backend/verify-scripts/verify-role-lockdown.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

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

async function main() {
  const stamp = Date.now().toString(36);
  const victimEmail = `victim-${stamp}@verify.test`;

  // --- victim: fresh client-role user --------------------------------------
  const victim = createClient(URL, ANON);
  const { data: victimSignup, error: victimSignupErr } = await victim.auth.signUp({
    email: victimEmail,
    password: 'VictimPass123!',
  });
  if (victimSignupErr) throw new Error(`victim signup: ${victimSignupErr.message}`);
  const victimId = victimSignup.user.id;
  console.log('setup: client-role victim', victimEmail);

  const { data: victimBefore } = await victim
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', victimId)
    .single();
  if (victimBefore?.role !== 'client') {
    throw new Error(`victim role unexpected: ${victimBefore?.role}`);
  }
  console.log('setup: victim role confirmed = client');

  // --- a) self role-change must be blocked ----------------------------------
  const { error: selfRoleErr } = await victim
    .from('profiles')
    .update({ role: 'super-admin' })
    .eq('id', victimId);

  const { data: afterSelfRole } = await victim
    .from('profiles')
    .select('role')
    .eq('id', victimId)
    .single();

  record(
    'a) client CANNOT change own role (self-promotion blocked)',
    afterSelfRole?.role === 'client',
    `attempt error: ${selfRoleErr ? selfRoleErr.message : 'none (silent)}'}; role after: ${afterSelfRole?.role}`,
  );

  // --- b) harmless own-field update must still work -------------------------
  const targetName = `Updated Name ${stamp}`;
  const { error: ownFieldErr } = await victim
    .from('profiles')
    .update({ full_name: targetName })
    .eq('id', victimId);

  const { data: afterOwnField } = await victim
    .from('profiles')
    .select('full_name')
    .eq('id', victimId)
    .single();

  record(
    'b) client CAN update own profile fields (full_name)',
    !ownFieldErr && afterOwnField?.full_name === targetName,
    ownFieldErr ? ownFieldErr.message : `full_name now: ${afterOwnField?.full_name}`,
  );

  // --- c) super-admin can change another user's role ------------------------
  const admin = createClient(URL, ANON);
  const { error: adminLoginErr } = await admin.auth.signInWithPassword({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
  });
  if (adminLoginErr) throw new Error(`super-admin login: ${adminLoginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  const { error: adminRoleErr } = await admin
    .from('profiles')
    .update({ role: 'super-admin' })
    .eq('id', victimId);

  const { data: afterAdminRole } = await admin
    .from('profiles')
    .select('role')
    .eq('id', victimId)
    .single();

  record(
    'c) super-admin CAN change another user\u2019s role',
    !adminRoleErr && afterAdminRole?.role === 'super-admin',
    adminRoleErr ? adminRoleErr.message : `victim role now: ${afterAdminRole?.role}`,
  );

  // --- summary ----------------------------------------------------------------
  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);
  console.log(`\nvictim user (left in place): ${victimEmail}`);

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nVERIFY SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});