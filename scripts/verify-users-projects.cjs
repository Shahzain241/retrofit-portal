/**
 * Users.jsx "# Projects" column verification.
 *
 * The column used to render a static "—" dash for every row even though a real
 * backing exists (projects.client_id). It now derives a real per-user count
 * from the `projects` table.
 *
 *   PART A — source checks
 *       a1) Users.jsx fetches projects and builds a real per-user count map
 *           (`projectCounts` from `projects.client_id`)
 *       a2) the "# Projects" cell renders the real count, not a static dash
 *
 *   PART B — live checks
 *       b1) a client with 2 owned projects has count 2 in the component's
 *           aggregation
 *       b2) a client with 0 owned projects has count 0
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to clean up test data.
 * Usage: node scripts/verify-users-projects.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
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
  path.join(__dirname, '..', 'src', 'pages', 'admin', 'Users.jsx'),
  'utf8',
);

// Mirrors the exact component aggregation.
function buildCounts(projects) {
  const counts = {};
  (projects ?? []).forEach((p) => {
    if (p.client_id) counts[p.client_id] = (counts[p.client_id] || 0) + 1;
  });
  return counts;
}

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    USERS_SRC.includes("from('projects')") &&
    USERS_SRC.includes("select('client_id')") &&
    USERS_SRC.includes('projectCounts') &&
    USERS_SRC.includes('setProjectCounts');
  record(
    'a1) Users.jsx fetches projects and builds a real per-user count map',
    a1,
    a1 ? '' : 'project-count wiring is missing',
  );

  const dashCount = (USERS_SRC.match(/\{'—'\}/g) ?? []).length;
  const a2 =
    USERS_SRC.includes('{projectCounts[u.id] ?? 0}') &&
    dashCount === 1;
  record(
    'a2) "# Projects" cell renders the real count (only Last Login keeps a dash)',
    a2,
    a2 ? '' : `projectCounts render missing or dash count=${dashCount} (expected 1)`,
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectIds = [`USRPRJ-${stamp}-1`, `USRPRJ-${stamp}-2`];
  const clientAEmail = `usrproj-a-${stamp}@verify.test`;
  const clientBEmail = `usrproj-b-${stamp}@verify.test`;

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);
  const {
    data: { session: adminSession },
  } = await admin.auth.getSession();

  async function createClientUser(email) {
    const c = createClient(URL, ANON);
    const { data, error } = await c.auth.signUp({ email, password: tempPassword() });
    if (error || !data?.user?.id) throw new Error(`signup ${email}: ${error?.message}`);
    if (adminSession) {
      await admin.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
    }
    return data.user.id;
  }
  const clientAId = await createClientUser(clientAEmail);
  const clientBId = await createClientUser(clientBEmail);
  console.log('setup: client A', clientAEmail, clientAId);
  console.log('setup: client B', clientBEmail, clientBId);

  // Client A owns 2 projects; client B owns none.
  const seeds = [
    { id: projectIds[0], name: 'Usr A1', status: 'active', progress: 10, address_line1: '1 A', address_city: 'London', address_postcode: 'SW1', service: 'HVAC', client_id: clientAId },
    { id: projectIds[1], name: 'Usr A2', status: 'active', progress: 20, address_line1: '2 A', address_city: 'London', address_postcode: 'SW1', service: 'HVAC', client_id: clientAId },
  ];
  const seedErrs = [];
  for (const s of seeds) {
    const { error } = await admin.from('projects').insert(s);
    if (error) seedErrs.push(error.message);
  }
  record('seed: 2 projects created for client A', seedErrs.length === 0, seedErrs.join('; ') || projectIds.join(', '));
  const seedingOk = seedErrs.length === 0;
  if (!seedingOk) {
    record('b1) client A count', false, 'seeding failed');
    record('b2) client B count', false, 'seeding failed');
  } else {
    const { data: allProjects } = await admin.from('projects').select('client_id');
    const counts = buildCounts(allProjects);
    record(
      'b1) client with 2 owned projects has count 2',
      counts[clientAId] === 2,
      `count=${counts[clientAId]}`,
    );
    record(
      'b2) client with 0 owned projects has count 0',
      (counts[clientBId] ?? 0) === 0,
      `count=${counts[clientBId] ?? 0}`,
    );
  }

  // --- cleanup -----------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: cleanupErr } = await admin.from('projects').delete().in('id', projectIds);
  const { data: leftover } = await admin.from('projects').select('id').in('id', projectIds);
  record(
    'cleanup: test projects deleted',
    !cleanupErr && (leftover?.length ?? 0) === 0,
    cleanupErr ? cleanupErr.message : `remaining=${leftover?.length ?? 0}`,
  );
  if (MGMT_TOKEN) {
    try {
      const emails = [`'${clientAEmail}'`, `'${clientBEmail}'`].join(', ');
      await runQuery(`delete from public.profiles where email in (${emails});`);
      await runQuery(`delete from auth.users where email in (${emails});`);
      const remaining = await runQuery(`select email from auth.users where email in (${emails});`);
      record('cleanup: test accounts deleted', (remaining?.length ?? 0) === 0, `remaining=${remaining?.length ?? 0}`);
    } catch (e) {
      record('cleanup: test accounts deleted', false, e.message);
    }
  } else {
    console.log('  SKIP  cleanup accounts — set SUPABASE_MANAGEMENT_TOKEN');
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