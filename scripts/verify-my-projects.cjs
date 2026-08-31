/**
 * MyProjects.jsx live-data + RLS verification.
 *
 * Confirms the data MyProjects.jsx renders (`.select('*').eq('client_id',
 * auth.uid()).order('created_at', desc)`) matches the RLS contract and that
 * the in-memory status filter (projectFilters: All / Active / Completed) works
 * against the live-fetched array:
 *
 *   1) a client fetches ONLY their own project rows, mapped correctly
 *      (address.line1/city/postcode, progress, status) from the DB columns
 *   2) a different client cannot read another client's projects
 *      (cross-client read by id is rejected by RLS)
 *   3) anon has no access to projects
 *   4) projectFilters logic filters the live array for each option
 *
 * Requires the policies in scripts/sql/07_client_projects_select_policy.sql:
 * "Clients can view own projects" SELECT + super-admin INSERT/UPDATE/DELETE
 * (used to seed/clean up the test projects).
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Cleanup: seeded projects are always deleted via super-admin DELETE. Test auth
 * accounts are only deleted when SUPABASE_MANAGEMENT_TOKEN is set; otherwise
 * they are left in place.
 *
 * Usage: node scripts/verify-my-projects.cjs
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

// Mirrors the exact fetch used by MyProjects.jsx.
async function fetchOwnProjects(client, uid) {
  return client
    .from('projects')
    .select('*')
    .eq('client_id', uid)
    .order('created_at', { ascending: false });
}

// Mirrors the exact shape mapping used by MyProjects.jsx.
function mapProject(p) {
  return {
    id: p.id,
    name: p.name,
    address: {
      line1: p.address_line1,
      city: p.address_city,
      postcode: p.address_postcode,
    },
    progress: p.progress ?? 0,
    status: p.status,
  };
}

// Mirrors the exact filter logic used by MyProjects.jsx.
function filterProjects(list, filter) {
  return list.filter((p) => {
    if (filter === 'All') return true;
    if (filter === 'Active') return p.status !== 'completed';
    return p.status === 'completed';
  });
}

const FILTER_OPTIONS = ['All', 'Active', 'Completed'];

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
  const projectIds = [
    `MYPRJ-${stamp}-A1`,
    `MYPRJ-${stamp}-A2`,
    `MYPRJ-${stamp}-A3`,
    `MYPRJ-${stamp}-B1`,
  ];
  const clientAEmail = `myproj-a-${stamp}@verify.test`;
  const clientBEmail = `myproj-b-${stamp}@verify.test`;
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
  // client A: A1 (active), A2 (completed), A3 (active)
  // client B: B1 (active)
  const seedA1 = { id: projectIds[0], name: 'Seed A1', status: 'active', progress: 65, address_line1: '1 A Street', address_city: 'London', address_postcode: 'NW1 1AA', service: 'HVAC Retrofit', client_id: clientAId };
  const seedA2 = { id: projectIds[1], name: 'Seed A2', status: 'completed', progress: 100, address_line1: '2 A Street', address_city: 'Manchester', address_postcode: 'M1 1BB', service: 'Insulation Upgrade', client_id: clientAId };
  const seedA3 = { id: projectIds[2], name: 'Seed A3', status: 'active', progress: 30, address_line1: '3 A Street', address_city: 'Leeds', address_postcode: 'LS1 2CC', service: 'Solar Installation', client_id: clientAId };
  const seedB1 = { id: projectIds[3], name: 'Seed B1', status: 'active', progress: 10, address_line1: '1 B Street', address_city: 'Birmingham', address_postcode: 'B1 1DD', service: 'HVAC Retrofit', client_id: clientBId };

  const seeds = [seedA1, seedA2, seedA3, seedB1];
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
      'Apply the policies from scripts/sql/07_client_projects_select_policy.sql, then re-run. ' +
      'Dependent checks below are SKIPPED.');
  }

  // --- 1) client A fetches ONLY their own rows, correctly mapped ------------
  if (!seedingOk) {
    recordSkip('1) client A fetches only own projects (mapped)', 'seeding failed');
  } else {
    const { data: raw, error: qErr } = await fetchOwnProjects(clientA, clientAId);
    const mapped = (raw ?? []).map(mapProject);
    const gotIds = mapped.map((p) => p.id);
    const expectedIds = [projectIds[0], projectIds[1], projectIds[2]];

    const idsCorrect = !qErr && gotIds.length === 3 && expectedIds.every((id) => gotIds.includes(id));
    record(
      '1) client A fetch returns exactly their 3 projects',
      idsCorrect,
      qErr ? qErr.message : `ids=${gotIds.join(', ')}`,
    );

    const rowById = Object.fromEntries((raw ?? []).map((r) => [r.id, r]));
    const mappingOk =
      idsCorrect &&
      projectIds.slice(0, 3).every((id) => {
        const db = rowById[id];
        const m = mapped.find((x) => x.id === id);
        return (
          m &&
          m.address.line1 === db.address_line1 &&
          m.address.city === db.address_city &&
          m.address.postcode === db.address_postcode &&
          m.progress === (db.progress ?? 0) &&
          m.status === db.status &&
          m.name === db.name
        );
      });
    record(
      '1) mapping matches DB columns (address/progress/status/name)',
      mappingOk,
      mappingOk ? 'all 3 rows mapped correctly' : 'mismatch in one or more mapped rows',
    );

    // --- 4) projectFilters logic against the live array -----------------------
    const rawByFilter = {
      All: [projectIds[0], projectIds[1], projectIds[2]],
      Active: [projectIds[0], projectIds[2]],
      Completed: [projectIds[1]],
    };
    const filterOk = FILTER_OPTIONS.every((f) => {
      const filtered = filterProjects(mapped, f).map((p) => p.id);
      return filtered.length === rawByFilter[f].length && rawByFilter[f].every((id) => filtered.includes(id));
    });
    record(
      '4) status filter (All/Active/Completed) matches expected counts',
      filterOk,
      filterOk
        ? 'All=3 Active=2 Completed=1'
        : `expected ${JSON.stringify(rawByFilter)} actual ${JSON.stringify(
            Object.fromEntries(FILTER_OPTIONS.map((f) => [f, filterProjects(mapped, f).map((p) => p.id)])),
          )}`,
    );
  }

  // --- 2) RLS: cross-client access rejected ---------------------------------
  if (!seedingOk) {
    recordSkip('2) client B cannot read client A projects', 'seeding failed');
  } else {
    const { data: bRaw, error: bErr } = await fetchOwnProjects(clientB, clientBId);
    const bIds = (bRaw ?? []).map((p) => p.id);
    record(
      '2) client B fetch returns only B1 (not client A rows)',
      !bErr && bIds.length === 1 && bIds[0] === projectIds[3],
      bErr ? bErr.message : `ids=${bIds.join(', ')}`,
    );

    const crossA = await clientB.from('projects').select('id').eq('id', projectIds[0]);
    record(
      '2) client B read of client A project by id rejected (0 rows)',
      !crossA.error && (crossA.data ?? []).length === 0,
      crossA.error ? crossA.error.message : `rows=${crossA.data?.length ?? 0}`,
    );

    const crossB = await clientA.from('projects').select('id').eq('id', projectIds[3]);
    record(
      '2) client A read of client B project by id rejected (0 rows)',
      !crossB.error && (crossB.data ?? []).length === 0,
      crossB.error ? crossB.error.message : `rows=${crossB.data?.length ?? 0}`,
    );
  }

  // --- 3) RLS: anon access rejected -----------------------------------------
  const anon = createClient(URL, ANON, CLIENT_OPTIONS);
  const anonProjects = await anon.from('projects').select('id');
  record(
    '3) anon cannot read projects',
    (anonProjects.data?.length ?? 0) === 0,
    `rows=${anonProjects.data?.length ?? 0}`,
  );

  // --- cleanup --------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: cleanupErr } = await admin
    .from('projects')
    .delete()
    .in('id', projectIds);
  const { data: leftover } = await admin
    .from('projects')
    .select('id')
    .in('id', projectIds);
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