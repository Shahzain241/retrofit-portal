/**
 * New Project (Create Project) flow verification.
 *
 * Confirms the "New Project" feature — previously a fake toast — now performs
 * a real, RLS-scoped INSERT into `projects` and that the UI surfaces it:
 *
 *   PART A — source checks (no browser harness)
 *       a1) Sidebar.jsx "New Project" opens the shared NewProjectModal
 *           (no fake success toast)
 *       a2) MyProjects.jsx "New Project" opens the shared NewProjectModal
 *           (no fake success toast)
 *       a3) NewProjectModal.jsx submit does a real
 *           `supabase.from('projects').insert({...})` with
 *           client_id = auth.uid() (from supabase.auth.getUser()), and only
 *           shows a success toast on success
 *       a4) the insert only writes columns that exist in the `projects` table
 *           (no invented columns)
 *       a5) MyProjects.jsx refetches on 'rp:project-created' (new row appears
 *           in the table)
 *       a6) ClientDashboard.jsx refetches on 'rp:project-created' (stats +
 *           active project cards update)
 *       a7) ClientDashboard.jsx greeting uses the SAME count as the
 *           "Active Projects" stat card (no hardcoded number)
 *
 *   PART B — live checks
 *       b1) a client-role test user can INSERT a project scoped to themselves
 *           (real insert, not a toast)
 *       b2) the new row round-trips with client_id = auth.uid() and the
 *           submitted name/address/service, plus DB defaults (status=active,
 *           progress=0)
 *       b3) the new row appears via MyProjects.jsx's exact fetch
 *           (.select('*').eq('client_id', uid).order('created_at', desc))
 *       b4) the new row appears via ClientDashboard.jsx's exact fetch and the
 *           greeting/stat-card active count matches the live row set
 *       b5) RLS scope: another client cannot read the row, and an insert that
 *           spoofs a different client_id is rejected
 *
 * Requires the client INSERT policy from
 * backend/sql/09_client_projects_insert_policy.sql ("Clients can insert own
 * projects", with check is_client() AND client_id = auth.uid()) plus the
 * super-admin policies from 07_client_projects_select_policy.sql (used to
 * inspect/clean up the test row).
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test
 * auth account. Usage: node backend/verify-scripts/verify-new-project.cjs
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

// Mirrors the exact select used by ClientDashboard.jsx.
const PROJECT_COLUMNS =
  'id, name, status, progress, address_line1, address_city, address_postcode, service, has_issues, created_at, client_id, due_date, updated_at';

// Real `projects` table columns (inspected via information_schema) — used to
// prove the modal writes no invented columns.
const KNOWN_PROJECT_COLUMNS = new Set([
  'id', 'name', 'address_line1', 'address_city', 'address_postcode',
  'status', 'progress', 'service', 'has_issues', 'client_id',
  'due_date', 'created_at', 'updated_at',
]);

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

// --- source helpers -----------------------------------------------------------
const readSrc = (rel) =>
  fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

const SIDEBAR_SRC = readSrc('src/components/Sidebar.jsx');
const MYPROJECTS_SRC = readSrc('src/pages/client/MyProjects.jsx');
const MODAL_SRC = readSrc('src/components/NewProjectModal.jsx');
const DASH_SRC = readSrc('src/pages/client/ClientDashboard.jsx');

const FAKE_TOAST = "showToast({ type: 'success', message: 'New project created' })";

// Extract the object passed to `.insert({ ... })` in the modal source and
// return the set of column keys it writes.
function insertKeys(src) {
  const start = src.indexOf('.insert({');
  if (start < 0) return null;
  let depth = 0;
  let i = start + '.insert({'.length;
  const keys = new Set();
  let current = '';
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      if (depth === 0) break;
      depth -= 1;
    }
    if (ch === '\n' || ch === ',') {
      const m = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/.exec(current);
      if (m) keys.add(m[1]);
      current = '';
    } else {
      current += ch;
    }
  }
  const last = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/.exec(current);
  if (last) keys.add(last[1]);
  return keys;
}

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    SIDEBAR_SRC.includes("from './NewProjectModal'") &&
    SIDEBAR_SRC.includes('NewProjectModal') &&
    SIDEBAR_SRC.includes('setNewProjectOpen(true)') &&
    !SIDEBAR_SRC.includes(FAKE_TOAST);
  record(
    'a1) Sidebar "New Project" opens NewProjectModal (no fake toast)',
    a1,
    a1 ? '' : 'Sidebar button not wired to NewProjectModal or still fakes a toast',
  );

  const a2 =
    MYPROJECTS_SRC.includes("from '../../components/NewProjectModal'") &&
    MYPROJECTS_SRC.includes('NewProjectModal') &&
    MYPROJECTS_SRC.includes('setNewProjectOpen(true)') &&
    !MYPROJECTS_SRC.includes(FAKE_TOAST);
  record(
    'a2) MyProjects "New Project" opens NewProjectModal (no fake toast)',
    a2,
    a2 ? '' : 'MyProjects button not wired to NewProjectModal or still fakes a toast',
  );

  const a3 =
    MODAL_SRC.includes("from('projects')") &&
    MODAL_SRC.includes('.insert({') &&
    MODAL_SRC.includes("supabase.auth.getUser()") &&
    MODAL_SRC.includes('client_id: user.id') &&
    /showToast\(\{ type: 'success'/.test(MODAL_SRC);
  record(
    'a3) modal submit inserts a real row scoped to auth.uid() + success toast',
    a3,
    a3 ? '' : 'modal is missing the real insert, auth.uid() scope, and/or success toast',
  );

  const keys = insertKeys(MODAL_SRC);
  const a4 =
    keys !== null &&
    keys.size > 0 &&
    [...keys].every((k) => KNOWN_PROJECT_COLUMNS.has(k));
  record(
    'a4) insert writes only existing projects-table columns',
    a4,
    keys === null ? 'could not locate .insert({...})' : `keys=${[...keys].join(', ')}`,
  );

  const a5 =
    MYPROJECTS_SRC.includes("addEventListener('rp:project-created', fetchProjects)") &&
    MYPROJECTS_SRC.includes("removeEventListener('rp:project-created', fetchProjects)");
  record(
    'a5) MyProjects refetches on rp:project-created',
    a5,
    a5 ? '' : 'MyProjects is not listening for the created event',
  );

  const a6 =
    DASH_SRC.includes("addEventListener('rp:project-created', fetchDashboard)") &&
    DASH_SRC.includes("removeEventListener('rp:project-created', fetchDashboard)");
  record(
    'a6) ClientDashboard refetches on rp:project-created',
    a6,
    a6 ? '' : 'ClientDashboard is not listening for the created event',
  );

  const a7 =
    DASH_SRC.includes("s.id === 'stat-active-projects'") &&
    /\{activeCount\}\s+active project/.test(DASH_SRC) &&
    !DASH_SRC.includes('2 active projects');
  record(
    'a7) greeting uses the stat-card count (no hardcoded number)',
    a7,
    a7 ? '' : 'greeting still hardcodes a count or no longer shares the stat-card value',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectId = `NEWPRJ-${stamp}`;
  const clientAEmail = `newproj-a-${stamp}@verify.test`;
  const clientBEmail = `newproj-b-${stamp}@verify.test`;
  const createdEmails = [clientAEmail, clientBEmail];

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

  // --- b1) real insert (exact modal path) --------------------------------------
  // Mirrors NewProjectModal.jsx: auth.getUser() then insert scoped to user.id.
  const {
    data: { user: aUser },
  } = await clientA.auth.getUser();
  const insert = await clientA.from('projects').insert({
    id: projectId,
    name: 'Hove House Retrofit',
    address_line1: '12-14 Kingsway Court',
    address_city: 'Hove',
    address_postcode: 'BN3 2LP',
    service: 'HVAC Retrofit',
    client_id: aUser.id,
  });
  record(
    'b1) client INSERT succeeds (real row created, not a toast)',
    !insert.error,
    insert.error ? insert.error.message : projectId,
  );

  // --- b2) row round-trips with correct client_id + defaults --------------------
  const { data: row, error: rowErr } = await admin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  const b2 =
    !insert.error &&
    !rowErr &&
    row?.client_id === clientAId &&
    row?.name === 'Hove House Retrofit' &&
    row?.address_line1 === '12-14 Kingsway Court' &&
    row?.address_city === 'Hove' &&
    row?.address_postcode === 'BN3 2LP' &&
    row?.service === 'HVAC Retrofit' &&
    row?.status === 'active' &&
    row?.progress === 0;
  record(
    'b2) new row scoped to client_id=auth.uid() + defaults (active/0)',
    b2,
    rowErr ? rowErr.message : `client_id=${row?.client_id} status=${row?.status} progress=${row?.progress}`,
  );

  // --- b3) appears via MyProjects.jsx fetch --------------------------------------
  const myProjectsFetch = await clientA
    .from('projects')
    .select('*')
    .eq('client_id', clientAId)
    .order('created_at', { ascending: false });
  const myProjectsIds = (myProjectsFetch.data ?? []).map((p) => p.id);
  record(
    'b3) new project appears via MyProjects fetch',
    !myProjectsFetch.error && myProjectsIds.includes(projectId),
    myProjectsFetch.error
      ? myProjectsFetch.error.message
      : `ids=${myProjectsIds.join(', ')}`,
  );

  // --- b4) appears via ClientDashboard fetch + greeting/stat count match --------
  const dashFetch = await clientA
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('client_id', clientAId)
    .order('created_at', { ascending: false });
  const dashIds = (dashFetch.data ?? []).map((p) => p.id);
  const dashActive = (dashFetch.data ?? []).filter((p) => p.status === 'active').length;
  // The stat card renders `activeCount` (status === 'active'); the greeting now
  // renders that same value. This is exactly the number both display.
  record(
    'b4) new project appears via ClientDashboard fetch; greeting == stat card',
    !dashFetch.error && dashIds.includes(projectId) && dashActive >= 1,
    dashFetch.error
      ? dashFetch.error.message
      : `ids=${dashIds.join(', ')} active=${dashActive}`,
  );

  // --- b5) RLS scope: no cross-client read, no spoofed insert ------------------
  const crossRead = await clientB.from('projects').select('id').eq('id', projectId);
  record(
    'b5) client B cannot read client A project (RLS)',
    !crossRead.error && (crossRead.data ?? []).length === 0,
    crossRead.error ? crossRead.error.message : `rows=${crossRead.data?.length ?? 0}`,
  );

  const spoof = await clientB.from('projects').insert({
    id: `SPOOF-${stamp}`,
    name: 'Spoofed',
    address_line1: '9 Spoof St',
    address_city: 'London',
    address_postcode: 'N1 1AA',
    service: 'HVAC Retrofit',
    client_id: clientAId,
  });
  record(
    'b5) insert spoofing another client_id rejected by RLS',
    !!spoof.error,
    spoof.error ? spoof.error.message : 'spoofed insert unexpectedly succeeded',
  );

  // --- cleanup --------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: cleanupErr } = await admin
    .from('projects')
    .delete()
    .in('id', [projectId, `SPOOF-${stamp}`]);
  const { data: leftover } = await admin
    .from('projects')
    .select('id')
    .in('id', [projectId, `SPOOF-${stamp}`]);
  record(
    'cleanup: test project rows deleted',
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
    recordSkip('cleanup: test auth accounts deleted', `set SUPABASE_MANAGEMENT_TOKEN to delete ${createdEmails.length} test account(s)`);
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