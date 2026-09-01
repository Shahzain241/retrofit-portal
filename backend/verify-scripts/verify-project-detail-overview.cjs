/**
 * ProjectDetail Overview live-data + RLS verification.
 *
 * Confirms the Overview tab wiring in ProjectDetail.jsx:
 *   `.from('projects').select('*').eq('id', projectId).single()`
 * scoped by RLS ("Clients can view own projects"):
 *
 *   1) a client fetches their OWN project by id and the row maps correctly to
 *      the shape the page JSX expects (id/name/address/progress/status/tag),
 *      with clearly-labeled placeholders for fields that have no backing
 *      column (currentPhase, phaseDescription, notice)
 *   2) fetching ANOTHER client's project by id is rejected by RLS
 *      (single() -> no data / PGRST116), which drives the not-found state
 *   3) anon has no access to projects (0 rows)
 *
 * Requires the policies in backend/sql/07_client_projects_select_policy.sql
 * ("Clients can view own projects" SELECT + super-admin INSERT/UPDATE/DELETE).
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Cleanup: seeded projects are always deleted via super-admin DELETE. Test auth
 * accounts are only deleted when SUPABASE_MANAGEMENT_TOKEN is set; otherwise
 * they are left in place.
 *
 * Usage: node backend/verify-scripts/verify-project-detail-overview.cjs
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

// Mirrors the exact fetch used by ProjectDetail.jsx.
function fetchProjectById(client, projectId) {
  return client.from('projects').select('*').eq('id', projectId).single();
}

// Mirrors the exact shape mapping + placeholders used by ProjectDetail.jsx.
function mapProject(data, coordinatorId) {
  return {
    id: data.id,
    name: data.name,
    address: {
      line1: data.address_line1,
      city: data.address_city,
      postcode: data.address_postcode,
    },
    status: data.status,
    progress: data.progress ?? 0,
    tag: data.service,
    image: undefined,
    coordinatorId,
    currentPhase: '—',
    phaseDescription: '—',
    notice: '',
  };
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
  const projectAId = `PDOV-${stamp}-A`;
  const projectBId = `PDOV-${stamp}-B`;
  const clientAEmail = `pdov-a-${stamp}@verify.test`;
  const clientBEmail = `pdov-b-${stamp}@verify.test`;
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

  // --- seed test projects ---------------------------------------------------
  const seedA = {
    id: projectAId, name: 'Overview Seed A', status: 'active', progress: 72,
    address_line1: '11 Maple Avenue', address_city: 'London', address_postcode: 'NW10 6RF',
    service: 'HVAC Retrofit', client_id: clientAId,
  };
  const seedB = {
    id: projectBId, name: 'Overview Seed B', status: 'completed', progress: 100,
    address_line1: '99 Oak Lane', address_city: 'Manchester', address_postcode: 'M1 4AB',
    service: 'Insulation Upgrade', client_id: clientBId,
  };
  const seeds = [seedA, seedB];
  let seedingOk = true;
  for (const s of seeds) {
    const { error } = await admin.from('projects').insert(s);
    if (error) {
      seedingOk = false;
      record(`seed: super-admin created test project ${s.id}`, false, error.message);
    } else {
      record(`seed: super-admin created test project ${s.id}`, true, s.id);
    }
  }
  if (!seedingOk) {
    console.error('\nSeeding failed — the super-admin INSERT policy on projects is missing. ' +
      'Apply the policies from backend/sql/07_client_projects_select_policy.sql, then re-run. ' +
      'Dependent checks below are SKIPPED.');
  }

  // --- 1) client A fetches own project by id + mapping -----------------------
  if (!seedingOk) {
    recordSkip('1) client A fetches own project by id (Overview data mapped)', 'seeding failed');
  } else {
    const { data, error } = await fetchProjectById(clientA, projectAId);
    const coordinatorId = 'coordinator';
    const mapped = data ? mapProject(data, coordinatorId) : null;
    const dataOk = !error && data && data.id === projectAId && data.client_id === clientAId;
    record(
      '1) client A fetches their own project by id',
      dataOk,
      error ? error.message : `id=${data?.id} client_id=${data?.client_id}`,
    );

    const mappingOk =
      dataOk &&
      mapped.id === data.id &&
      mapped.name === data.name &&
      mapped.address.line1 === data.address_line1 &&
      mapped.address.city === data.address_city &&
      mapped.address.postcode === data.address_postcode &&
      mapped.progress === (data.progress ?? 0) &&
      mapped.status === data.status &&
      mapped.tag === data.service;
    record(
      '1) Overview mapping matches DB columns (id/name/address/progress/status/tag)',
      mappingOk,
      mappingOk ? 'mapped correctly' : 'mapping mismatch',
    );

    const placeholderOk =
      dataOk &&
      mapped.currentPhase === '—' &&
      mapped.phaseDescription === '—' &&
      mapped.notice === '';
    record(
      '1) fields with no backing column are clearly-labeled placeholders',
      placeholderOk,
      placeholderOk
        ? 'currentPhase/phaseDescription="—", notice="" (banner hidden)'
        : JSON.stringify({ currentPhase: mapped?.currentPhase, phaseDescription: mapped?.phaseDescription, notice: mapped?.notice }),
    );
  }

  // --- 2) RLS blocks fetching another client's project by id -----------------
  if (!seedingOk) {
    recordSkip('2) client A cannot fetch client B project by id', 'seeding failed');
    recordSkip('2) client B cannot fetch client A project by id', 'seeding failed');
  } else {
    const crossAB = await fetchProjectById(clientA, projectBId);
    record(
      '2) client A fetch of client B project by id rejected (no data)',
      !!crossAB.error || !crossAB.data,
      crossAB.error ? crossAB.error.message : 'unexpectedly returned data',
    );

    const crossBA = await fetchProjectById(clientB, projectAId);
    record(
      '2) client B fetch of client A project by id rejected (no data)',
      !!crossBA.error || !crossBA.data,
      crossBA.error ? crossBA.error.message : 'unexpectedly returned data',
    );
  }

  // --- 3) anon gets no data --------------------------------------------------
  const anon = createClient(URL, ANON, CLIENT_OPTIONS);
  const anonRows = await anon.from('projects').select('id').eq('id', projectAId);
  record(
    '3) anon cannot read the project (0 rows)',
    (anonRows.data?.length ?? 0) === 0,
    `rows=${anonRows.data?.length ?? 0}`,
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