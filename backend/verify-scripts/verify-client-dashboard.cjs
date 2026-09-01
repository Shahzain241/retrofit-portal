/**
 * Client Dashboard live-data + RLS verification.
 *
 * Confirms the data ClientDashboard.jsx renders (rows scoped via
 * `.eq('client_id', auth.uid())`) matches the RLS contract on `projects`:
 *
 *   a) a client sees ONLY their own project rows (client_id = their uid)
 *   b) a client never sees another client's project (no cross-client leak)
 *   c) a direct cross-client read by id is rejected by RLS (0 rows)
 *   d) a super-admin can still read all projects
 *
 * Requires the policies in backend/sql/07_client_projects_select_policy.sql
 * ("Clients can view own projects" SELECT + the super-admin INSERT/UPDATE/DELETE
 * policies used to seed and clean up the two test projects).
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Cleanup: the seeded projects are always deleted via super-admin DELETE. The
 * two test auth accounts are only deleted when SUPABASE_MANAGEMENT_TOKEN is set
 * (Management API query endpoint); otherwise they are left in place.
 *
 * Usage: node backend/verify-scripts/verify-client-dashboard.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
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

// Mirrors the exact select used by ClientDashboard.jsx.
const PROJECT_COLUMNS =
  'id, name, status, progress, address_line1, address_city, address_postcode, service, has_issues, created_at, client_id, due_date, updated_at';

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
  const projectAId = `DASHV-${stamp}-A`;
  const projectBId = `DASHV-${stamp}-B`;
  const clientAEmail = `dashclient-a-${stamp}@verify.test`;
  const clientBEmail = `dashclient-b-${stamp}@verify.test`;
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

  // --- seed two projects (one per client) ----------------------------------
  const seedProject = {
    id: 'x',
    name: 'Seed Retrofit',
    status: 'active',
    progress: 42,
    address_line1: '1 Seed Street',
    address_city: 'London',
    address_postcode: 'SW1A 1AA',
    service: 'HVAC Retrofit',
    client_id: 'x',
  };
  const { error: insertAErr } = await admin
    .from('projects')
    .insert({ ...seedProject, id: projectAId, client_id: clientAId });
  const { error: insertBErr } = await admin
    .from('projects')
    .insert({ ...seedProject, id: projectBId, client_id: clientBId });
  record(
    'seed: super-admin created test project for client A',
    !insertAErr,
    insertAErr ? insertAErr.message : projectAId,
  );
  record(
    'seed: super-admin created test project for client B',
    !insertBErr,
    insertBErr ? insertBErr.message : projectBId,
  );
  const seedingOk = !insertAErr && !insertBErr;
  if (!seedingOk) {
    console.error('\nSeeding failed — the super-admin INSERT policy on projects is missing. ' +
      'Apply the super-admin INSERT/UPDATE/DELETE policies from ' +
      'backend/sql/07_client_projects_select_policy.sql, then re-run. ' +
      'The dependent RLS checks below are SKIPPED.');
  }

  // --- a) each client sees ONLY their own rows ------------------------------
  if (!seedingOk) {
    recordSkip('a) client A dashboard query returns only their own project', 'seeding failed');
    recordSkip('a) client B dashboard query returns only their own project', 'seeding failed');
  } else {
    const qA = await clientA
      .from('projects')
      .select(PROJECT_COLUMNS)
      .eq('client_id', clientAId)
      .order('created_at', { ascending: false });
    const rowsA = qA.data ?? [];
    record(
      'a) client A dashboard query returns only their own project',
      !qA.error && rowsA.length === 1 && rowsA[0].id === projectAId && rowsA[0].client_id === clientAId,
      qA.error ? qA.error.message : `rows=${rowsA.map((r) => r.id).join(', ')}`,
    );

    const qB = await clientB
      .from('projects')
      .select(PROJECT_COLUMNS)
      .eq('client_id', clientBId)
      .order('created_at', { ascending: false });
    const rowsB = qB.data ?? [];
    record(
      'a) client B dashboard query returns only their own project',
      !qB.error && rowsB.length === 1 && rowsB[0].id === projectBId && rowsB[0].client_id === clientBId,
      qB.error ? qB.error.message : `rows=${rowsB.map((r) => r.id).join(', ')}`,
    );
  }

  // --- b) no cross-client leak on a full (unfiltered) select -----------------
  const qAAll = await clientA.from('projects').select(PROJECT_COLUMNS);
  const aAll = (qAAll.data ?? []).filter((r) => r.client_id === clientAId);
  record(
    'b) client A full select leaks no other client rows',
    !qAAll.error && (qAAll.data ?? []).length === aAll.length,
    `visible=${(qAAll.data ?? []).length} own=${aAll.length}`,
  );

  // --- c) RLS rejects a direct cross-client read by id ----------------------
  const cross = await clientA.from('projects').select(PROJECT_COLUMNS).eq('id', projectBId);
  record(
    'c) RLS rejects cross-client read by id (0 rows)',
    !cross.error && (cross.data ?? []).length === 0,
    cross.error ? cross.error.message : `rows=${cross.data?.length ?? 0}`,
  );

  // --- d) super-admin can still read all projects ----------------------------
  if (!seedingOk) {
    recordSkip('d) super-admin can read all projects (both seeded rows)', 'seeding failed');
  } else {
    const adminAll = await admin.from('projects').select('id, client_id').in('id', [projectAId, projectBId]);
    const adminIds = (adminAll.data ?? []).map((r) => r.id).sort();
    record(
      'd) super-admin can read all projects (both seeded rows)',
      !adminAll.error && adminIds.length === 2 && adminIds[0] === projectAId && adminIds[1] === projectBId,
      adminAll.error ? adminAll.error.message : `ids=${adminIds.join(', ')}`,
    );
  }

  // --- e) RLS: client still cannot read other tables -------------------------
  const clientServices = await clientA.from('services').select('id');
  record(
    'e) RLS: client-role cannot read services',
    (clientServices.data?.length ?? 0) === 0,
    `rows=${clientServices.data?.length ?? 0}`,
  );

  // --- cleanup --------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: cleanupErr } = await admin
    .from('projects')
    .delete()
    .in('id', [projectAId, projectBId]);
  const { data: leftover } = await admin
    .from('projects')
    .select('id')
    .in('id', [projectAId, projectBId]);
  record(
    'cleanup: seeded test projects deleted',
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
    console.log(`  SKIP  cleanup of auth users — set SUPABASE_MANAGEMENT_TOKEN to delete ${createdEmails.length} test account(s)`);
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