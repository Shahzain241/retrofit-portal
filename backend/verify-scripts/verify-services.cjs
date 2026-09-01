/**
 * End-to-end RLS + CRUD verification for the `services` table.
 *
 * Covers:
 *   a) super-admin INSERT  -> row created, data matches
 *   b) fetch back          -> data matches
 *   c) super-admin UPDATE  -> change persisted (and updated_at advances)
 *   d) super-admin DELETE  -> row gone
 *   e) anon INSERT         -> rejected by RLS
 *   f) anon UPDATE/DELETE  -> no effect (RLS skips unauthorized rows)
 *   g) client-role user    -> same negative checks (proves policies check
 *                             profiles.role via is_super_admin(), not JWT claims)
 *
 * A dedicated super-admin test account is provisioned out-of-band via SQL
 * and used for the write-path checks, since self-escalation of profiles.role
 * is now blocked by RLS by design. Credentials come from env vars (see
 * backend/.env.example): VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD.
 *
 * Usage: node backend/verify-scripts/verify-services.cjs
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
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function createUser(client, email, password) {
  const { error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(`signUp ${email}: ${error.message}`);
}

async function main() {
  const stamp = Date.now().toString(36);

  // --- Setup: super-admin + non-admin users --------------------------------
  const adminClient = createClient(URL, ANON);
  const { error: adminLoginErr } = await adminClient.auth.signInWithPassword({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
  });
  if (adminLoginErr) throw new Error(`super-admin login: ${adminLoginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  const clientClient = createClient(URL, ANON);
  const clientEmail = `client-${stamp}@verify.test`;
  await createUser(clientClient, clientEmail, 'VerifyPass123!');
  const { data: clientProfile } = await clientClient
    .from('profiles')
    .select('role')
    .eq('email', clientEmail)
    .single();
  if (clientProfile?.role !== 'client') {
    throw new Error(`client role unexpected, role=${clientProfile?.role}`);
  }
  console.log('setup: non-admin (client) role confirmed on profiles');

  const anonClient = createClient(URL, ANON);

  // --- a) super-admin INSERT ----------------------------------------------
  const payload = {
    title: `Verify Service ${stamp}`,
    price: 149.5,
    working_days: 5,
    deliverables: 4,
    status: 'active',
  };
  const { data: inserted, error: insertErr } = await adminClient
    .from('services')
    .insert(payload)
    .select('*')
    .single();
  record(
    'a) super-admin INSERT succeeds',
    !insertErr && !!inserted?.id,
    insertErr ? insertErr.message : `id=${inserted.id}`,
  );
  if (!inserted?.id) throw new Error('super-admin insert failed, cannot continue');

  const row = inserted;

  // --- b) fetch back & data matches ---------------------------------------
  const { data: fetched, error: fetchErr } = await adminClient
    .from('services')
    .select('*')
    .eq('id', row.id)
    .single();
  const matches =
    !fetchErr &&
    fetched?.title === payload.title &&
    Number(fetched?.price) === Number(payload.price) &&
    Number(fetched?.working_days) === Number(payload.working_days) &&
    Number(fetched?.deliverables) === Number(payload.deliverables) &&
    fetched?.status === payload.status;
  record('b) fetch back matches inserted data', matches, fetchErr ? fetchErr.message : JSON.stringify(fetched));

  // --- e) anon negative checks (before update/delete so row still exists) --
  const { data: anonInsertData, error: anonInsertErr } = await anonClient
    .from('services')
    .insert({ title: 'anon', price: 1, working_days: 1, deliverables: 1, status: 'active' })
    .select('id');
  record(
    'e) anon INSERT rejected by RLS',
    !!anonInsertErr && (anonInsertData?.length ?? 0) === 0,
    anonInsertErr ? anonInsertErr.message : 'no error (allowed!)',
  );

  const { error: anonUpdErr } = await anonClient.from('services').update({ title: 'anon-edit' }).eq('id', row.id);
  const { data: afterAnonUpd } = await adminClient.from('services').select('title').eq('id', row.id).single();
  record(
    'f) anon UPDATE has no effect',
    afterAnonUpd?.title === payload.title && !(anonUpdErr && afterAnonUpd?.title === 'anon-edit'),
    anonUpdErr ? anonUpdErr.message : 'silently skipped (row unchanged)',
  );

  const { error: anonDelErr } = await anonClient.from('services').delete().eq('id', row.id);
  const { data: afterAnonDel, error: afterAnonDelErr } = await adminClient.from('services').select('id').eq('id', row.id);
  record(
    'f) anon DELETE has no effect',
    !afterAnonDelErr && (afterAnonDel?.length ?? 0) === 1,
    anonDelErr ? anonDelErr.message : 'silently skipped (row still present)',
  );

  // --- g) client-role (non-admin) negative checks -------------------------
  const { data: clientInsertData, error: clientInsertErr } = await clientClient
    .from('services')
    .insert({ title: 'client', price: 1, working_days: 1, deliverables: 1, status: 'active' })
    .select('id');
  record(
    'g) client-role INSERT rejected by RLS (is_super_admin() reads profiles.role)',
    !!clientInsertErr && (clientInsertData?.length ?? 0) === 0,
    clientInsertErr ? clientInsertErr.message : 'no error (allowed!)',
  );

  const { error: clientUpdErr } = await clientClient.from('services').update({ title: 'client-edit' }).eq('id', row.id);
  const { data: afterClientUpd } = await adminClient.from('services').select('title').eq('id', row.id).single();
  record(
    'g) client-role UPDATE has no effect',
    afterClientUpd?.title === payload.title,
    clientUpdErr ? clientUpdErr.message : 'silently skipped (row unchanged)',
  );

  const { error: clientDelErr } = await clientClient.from('services').delete().eq('id', row.id);
  const { data: afterClientDel, error: afterClientDelErr } = await adminClient.from('services').select('id').eq('id', row.id);
  record(
    'g) client-role DELETE has no effect',
    !afterClientDelErr && (afterClientDel?.length ?? 0) === 1,
    clientDelErr ? clientDelErr.message : 'silently skipped (row still present)',
  );

  // --- c) super-admin UPDATE -----------------------------------------------
  const { error: updateErr } = await adminClient
    .from('services')
    .update({ title: `${payload.title} (updated)`, price: 259.99 })
    .eq('id', row.id);
  const { data: afterUpd, error: afterUpdErr } = await adminClient.from('services').select('*').eq('id', row.id).single();
  const updatedAtAdvanced = new Date(afterUpd?.updated_at || 0) > new Date(row.updated_at || 0);
  record(
    'c) super-admin UPDATE persists',
    !updateErr && !afterUpdErr && afterUpd?.title === `${payload.title} (updated)` && Number(afterUpd?.price) === 259.99,
    updateErr || afterUpdErr ? (updateErr || afterUpdErr).message : 'title+price changed',
  );
  record('c) updated_at auto-advanced (trigger)', updatedAtAdvanced, `before=${row.updated_at} after=${afterUpd?.updated_at}`);

  // --- d) super-admin DELETE ------------------------------------------------
  const { error: deleteErr } = await adminClient.from('services').delete().eq('id', row.id);
  const { data: afterDel, error: afterDelErr } = await adminClient.from('services').select('id').eq('id', row.id);
  record(
    'd) super-admin DELETE removes row',
    !deleteErr && !afterDelErr && (afterDel?.length ?? 0) === 0,
    deleteErr || afterDelErr ? (deleteErr || afterDelErr).message : 'row gone',
  );

  // --- summary --------------------------------------------------------------
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