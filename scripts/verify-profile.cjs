/**
 * Profile.jsx live-data + RLS verification.
 *
 * Confirms the Profile wiring in Profile.jsx / ProfileContext.jsx:
 *
 *   1) a client can fetch their own profile row with the new columns
 *      (first_name, last_name, phone, property_address, property_type,
 *      epc_number, notifications)
 *   2) a client can UPDATE their OWN row (identity fields, property fields,
 *      notifications jsonb) — the writes persist in `profiles`
 *   3) a client CANNOT update another client's profile row (RLS)
 *   4) anon cannot read or update profiles
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Cleanup: the two test client accounts (and their profile rows) are only
 * deleted when SUPABASE_MANAGEMENT_TOKEN is set; otherwise left in place.
 *
 * Usage: node scripts/verify-profile.cjs
 */

const { createClient } = require('@supabase/supabase-js');

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

// Mirrors the exact fetch used by ProfileContext.jsx.
async function fetchOwnProfile(client, userId) {
  return client.from('profiles').select('*').eq('id', userId).single();
}

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

async function main() {
  const stamp = Date.now().toString(36);
  const clientAEmail = `prof-a-${stamp}@verify.test`;
  const clientBEmail = `prof-b-${stamp}@verify.test`;
  const createdEmails = [clientAEmail, clientBEmail];

  // --- super-admin session --------------------------------------------------
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

  // --- create two client-role test accounts ---------------------------------
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

  // --- 1) client can fetch their own profile row with the new fields --------
  const own = await fetchOwnProfile(clientA, clientAId);
  const ownRow = own.data;
  const ownOk =
    !own.error &&
    ownRow &&
    ownRow.id === clientAId &&
    'first_name' in ownRow &&
    'last_name' in ownRow &&
    'phone' in ownRow &&
    'property_address' in ownRow &&
    'property_type' in ownRow &&
    'epc_number' in ownRow &&
    'notifications' in ownRow &&
    ownRow.email === clientAEmail;
  record(
    '1) client A fetches own profile row with new columns',
    ownOk,
    own.error ? own.error.message : `first_name=${ownRow?.first_name} phone=${ownRow?.phone} notifications=${JSON.stringify(ownRow?.notifications)}`,
  );

  // --- 2) client can UPDATE own identity/property/notifications --------------
  if (!ownOk) {
    recordSkip('2) client A UPDATE own row (identity/property/notifications)', 'own fetch failed');
  } else {
    const patch = {
      first_name: `First${stamp}`,
      last_name: `Last${stamp}`,
      phone: '+44 7000 000000',
      property_address: '10 Update Street',
      property_type: 'Detached',
      epc_number: `EPC-${stamp}`,
      notifications: { push: true },
    };
    const upd = await clientA.from('profiles').update(patch).eq('id', clientAId).select('id, first_name, last_name, phone, property_address, property_type, epc_number, notifications');
    const refetch = await fetchOwnProfile(clientA, clientAId);
    const after = refetch.data;
    const ok =
      !upd.error &&
      after &&
      after.first_name === patch.first_name &&
      after.last_name === patch.last_name &&
      after.phone === patch.phone &&
      after.property_address === patch.property_address &&
      after.property_type === patch.property_type &&
      after.epc_number === patch.epc_number &&
      after.notifications?.push === true;
    record(
      '2) client A UPDATEs own identity/property/notifications (persisted)',
      ok,
      upd.error ? upd.error.message : `after=${JSON.stringify({ first_name: after?.first_name, phone: after?.phone, property_address: after?.property_address, notifications: after?.notifications })}`,
    );

    // confirm super-admin also sees the persisted values (real DB write)
    const adminView = await admin.from('profiles').select('first_name, phone, property_address, notifications').eq('id', clientAId).single();
    record(
      '2) write visible to super-admin (persisted in Supabase)',
      !adminView.error &&
        adminView.data?.first_name === patch.first_name &&
        adminView.data?.phone === patch.phone &&
        adminView.data?.property_address === patch.property_address &&
        adminView.data?.notifications?.push === true,
      adminView.error ? adminView.error.message : JSON.stringify(adminView.data),
    );
  }

  // --- 3) client CANNOT update another client's profile row ------------------
  if (!ownOk) {
    recordSkip('3) client A cannot UPDATE client B row', 'own fetch failed');
  } else {
    const other = await fetchOwnProfile(clientB, clientBId);
    const bBefore = other.data?.first_name ?? null;

    const updOther = await clientA.from('profiles').update({ first_name: 'HACKED' }).eq('id', clientBId).select('id');
    const bAfter = await admin.from('profiles').select('first_name').eq('id', clientBId).single();
    record(
      '3) client A cannot UPDATE client B profile row',
      (updOther.data ?? []).length === 0 && bAfter.data?.first_name === bBefore,
      updOther.error ? updOther.error.message : `client B first_name still=${bAfter.data?.first_name} (was ${bBefore})`,
    );
  }

  // --- 4) anon cannot read or update -----------------------------------------
  const anon = createClient(URL, ANON, CLIENT_OPTIONS);
  const anonRows = await anon.from('profiles').select('id');
  record(
    '4) anon cannot read profiles (0 rows)',
    (anonRows.data?.length ?? 0) === 0,
    `rows=${anonRows.data?.length ?? 0}`,
  );
  const anonUpd = await anon.from('profiles').update({ first_name: 'anon' }).eq('id', clientAId).select('id');
  const afterAnon = await admin.from('profiles').select('first_name').eq('id', clientAId).single();
  record(
    '4) anon UPDATE has no effect',
    (anonUpd.data ?? []).length === 0 && afterAnon.data?.first_name === `First${stamp}`,
    anonUpd.error ? anonUpd.error.message : `first_name still=${afterAnon.data?.first_name}`,
  );

  // --- cleanup --------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      const emails = createdEmails.map((e) => `'${e}'`).join(', ');
      await runQuery(`delete from public.profiles where email in (${emails});`);
      await runQuery(`delete from auth.users where email in (${emails});`);
      const remaining = await runQuery(
        `select email from auth.users where email in (${emails});`,
      );
      record(
        `cleanup: ${createdEmails.length} test account(s) deleted`,
        (remaining?.length ?? 0) === 0,
        `remaining=${remaining?.length ?? 0}`,
      );
    } catch (e) {
      record('cleanup: test accounts deleted', false, e.message);
    }
  } else {
    console.log(`  SKIP  cleanup of test accounts — set SUPABASE_MANAGEMENT_TOKEN to delete ${createdEmails.length} test account(s)`);
  }

  // --- summary ----------------------------------------------------------------
  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}   SKIPPED: ${skipped}`);
  console.log(`\nclient-role test users (left in place): ${clientAEmail}, ${clientBEmail}`);

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nVERIFY SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});