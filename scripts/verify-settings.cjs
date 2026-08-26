/**
 * Settings page backend-path verification.
 *
 * NOTE: Settings.jsx currently edits only app-level mock settings (email
 * template + integration health, persisted to localStorage via ProfileContext)
 * — it exposes NO profile fields and NO email/password UI. This script verifies
 * the real `profiles` own-row read/update path a settings feature relies on,
 * using the canonical own-profile query
 *   supabase.from('profiles').select('*').eq('id', auth.uid())
 *
 * Checks:
 *   a) super-admin can fetch their own profile
 *   b) super-admin can update a harmless own field (full_name) and it persists
 *   c) the update can be reverted to the original value
 *   d) RLS still rejects one user updating ANOTHER user's profile row
 *   e) (bonus) RLS rejects a non-admin reading another user's profile row
 *
 * Super-admin credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Usage: node scripts/verify-settings.cjs
 */

const { createClient } = require('@supabase/supabase-js');

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

async function main() {
  const stamp = Date.now().toString(36);

  // --- super-admin session --------------------------------------------------
  const admin = createClient(URL, ANON);
  const { data: auth, error: loginErr } = await admin.auth.signInWithPassword({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
  });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  // --- a) fetch own profile (canonical settings query) ----------------------
  const { data: profile, error: fetchErr } = await admin
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .single();
  record(
    'a) super-admin can fetch own profile',
    !fetchErr && !!profile && profile.id === auth.user.id,
    fetchErr ? fetchErr.message : `id=${profile?.id} role=${profile?.role}`,
  );
  if (!profile) throw new Error('could not fetch own profile, cannot continue');

  const originalFullName = profile.full_name ?? null;
  const sentinel = `Settings Verify ${stamp}`;

  // --- b) update own harmless field and confirm persistence -----------------
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ full_name: sentinel })
    .eq('id', profile.id);
  const { data: afterUpdate, error: afterUpdateErr } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', profile.id)
    .single();
  record(
    'b) super-admin can update own profile (full_name) and it persists',
    !updateErr && !afterUpdateErr && afterUpdate?.full_name === sentinel,
    updateErr || afterUpdateErr ? (updateErr || afterUpdateErr).message : `full_name now: ${afterUpdate?.full_name}`,
  );

  // --- c) revert the update ---------------------------------------------------
  const { error: revertErr } = await admin
    .from('profiles')
    .update({ full_name: originalFullName })
    .eq('id', profile.id);
  const { data: afterRevert, error: afterRevertErr } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', profile.id)
    .single();
  record(
    'c) super-admin can revert the change',
    !revertErr && !afterRevertErr && (afterRevert?.full_name ?? null) === originalFullName,
    revertErr || afterRevertErr ? (revertErr || afterRevertErr).message : `full_name back to: ${afterRevert?.full_name ?? '(null)'}`,
  );

  // --- d) RLS: another user cannot update this profile row --------------------
  const client = createClient(URL, ANON);
  const clientEmail = `setverify-${stamp}@verify.test`;
  const { error: signupErr } = await client.auth.signUp({
    email: clientEmail,
    password: 'VerifyPass123!',
  });
  if (signupErr) throw new Error(`client signup: ${signupErr.message}`);
  console.log('setup: client-role user', clientEmail);

  const { error: crossUpdateErr } = await client
    .from('profiles')
    .update({ full_name: 'Hacked-By-Client' })
    .eq('id', profile.id);
  const { data: afterCross } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', profile.id)
    .single();
  record(
    'd) RLS rejects a user updating another user\u2019s profile row',
    (afterCross?.full_name ?? null) === originalFullName,
    `${crossUpdateErr ? `error: ${crossUpdateErr.message}; ` : 'no error (silently skipped); '}target full_name still: ${afterCross?.full_name ?? '(null)'}`,
  );

  // --- e) RLS: another user cannot read this profile row ----------------------
  const { data: crossRead, error: crossReadErr } = await client
    .from('profiles')
    .select('id')
    .eq('id', profile.id);
  record(
    'e) RLS rejects a user reading another user\u2019s profile row',
    !crossReadErr && (crossRead?.length ?? 0) === 0,
    `rows=${crossRead?.length ?? 0}`,
  );

  // --- summary ----------------------------------------------------------------
  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);
  console.log(`\nclient-role user (left in place): ${clientEmail}`);

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nVERIFY SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});