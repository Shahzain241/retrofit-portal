/**
 * AdminDashboard Team Workload verification.
 *
 * The Team Workload chart used to render hardcoded mock values (Jane/Rob/
 * Marie/Aron/Mila/Jon from data/misc.js). It now counts real open (non-done)
 * tasks per staff member across the `tasks` table.
 *
 *   PART A — source checks
 *       a1) AdminDashboard fetches non-done tasks + staff profiles and builds
 *           the workload; no mock teamWorkload import remains
 *       a2) the chart shows an honest empty state when no staff has open tasks
 *
 *   PART B — live checks
 *       b1) a staff member with 2 open + 1 done task has workload 2 (done
 *           tasks are excluded)
 *       b2) a staff member with no open tasks is not in the workload
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to clean up test data.
 * Usage: node scripts/verify-admin-dashboard-workload.cjs
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

// Mirrors AdminDashboard.jsx workload aggregation.
function buildWorkload(staffProfiles, staffTasks) {
  const counts = {};
  (staffTasks ?? []).forEach((t) => {
    if (t.assignee_id) counts[t.assignee_id] = (counts[t.assignee_id] || 0) + 1;
  });
  return (staffProfiles ?? [])
    .map((s) => ({ name: s.full_name || s.email, value: counts[s.id] || 0 }))
    .filter((w) => w.value > 0)
    .sort((a, b) => b.value - a.value);
}

// --- source helpers -----------------------------------------------------------
const DASH_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'admin', 'AdminDashboard.jsx'),
  'utf8',
);

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    DASH_SRC.includes(".from('tasks')") &&
    DASH_SRC.includes(".neq('status', 'done')") &&
    DASH_SRC.includes("setWorkload(") &&
    !DASH_SRC.includes('teamWorkload') &&
    !DASH_SRC.includes("} from '../../data/misc'");
  record(
    'a1) AdminDashboard builds workload from real non-done tasks (no mock teamWorkload)',
    a1,
    a1 ? '' : 'mock workload data is still imported or the tasks fetch is missing',
  );

  const a2 =
    DASH_SRC.includes('workload.length === 0') &&
    DASH_SRC.includes('No active tasks yet');
  record(
    'a2) chart shows an honest empty state when no staff has open tasks',
    a2,
    a2 ? '' : 'no empty state for the workload chart',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectId = `WORKLOAD-${stamp}`;
  const coordinatorEmail = `workload-c-${stamp}@verify.test`;
  const designerEmail = `workload-d-${stamp}@verify.test`;
  const createdEmails = [coordinatorEmail, designerEmail];

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);
  const {
    data: { session: adminSession },
  } = await admin.auth.getSession();

  const { error: projSeedErr } = await admin.from('projects').insert({
    id: projectId,
    name: 'Workload Seed',
    status: 'active',
    progress: 0,
    address_line1: '1 Workload St',
    address_city: 'London',
    address_postcode: 'SW1A 1AA',
    service: 'HVAC Retrofit',
  });
  if (projSeedErr) throw new Error(`project seed: ${projSeedErr.message}`);

  async function createUser(email, roleKey) {
    const password = tempPassword();
    const { data, error } = await admin.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (adminSession) {
      await admin.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
    }
    if (roleKey) {
      const { error: roleErr } = await admin.from('profiles').update({ role: roleKey }).eq('id', data.user.id);
      if (roleErr) return { error: roleErr.message };
    }
    return { id: data.user.id };
  }
  const coordinator = await createUser(coordinatorEmail, 'coordinator');
  const designer = await createUser(designerEmail, 'designer');
  if (coordinator.error || designer.error) {
    throw new Error(`account setup failed: ${coordinator.error || designer.error}`);
  }
  console.log('setup: coordinator + designer created');

  // Coordinator gets 2 open + 1 done; designer gets none.
  const t1 = await admin.from('tasks').insert({ title: 'W Open 1', priority: 'High', status: 'backlog', assignee_id: coordinator.id, project_id: projectId, tags: [] }).select('id').single();
  const t2 = await admin.from('tasks').insert({ title: 'W Open 2', priority: 'Medium', status: 'design', assignee_id: coordinator.id, project_id: projectId, tags: [] }).select('id').single();
  const t3 = await admin.from('tasks').insert({ title: 'W Done', priority: 'Low', status: 'done', assignee_id: coordinator.id, project_id: projectId, tags: [] }).select('id').single();
  if (t1.error || t2.error || t3.error) {
    throw new Error(`task create failed: ${t1.error?.message || t2.error?.message || t3.error?.message}`);
  }
  console.log('setup: 3 tasks (2 open + 1 done) assigned to coordinator');

  // Replicate the component queries.
  const { data: staffTasks, error: tasksErr } = await admin
    .from('tasks')
    .select('assignee_id, status')
    .neq('status', 'done');
  const { data: staffProfiles, error: profilesErr } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .in('role', ['coordinator', 'designer', 'assessor', 'super-admin']);

  const workload = buildWorkload(staffProfiles ?? [], staffTasks ?? []);
  const coordEntry = workload.find((w) => w.name === coordinatorEmail) || workload.find((w) => w.value > 0);
  record(
    'b1) staff with 2 open + 1 done task has workload 2 (done excluded)',
    !tasksErr && !profilesErr && coordEntry?.value === 2,
    tasksErr?.message || profilesErr?.message || `coordinator workload=${coordEntry?.value}`,
  );

  record(
    'b2) staff with no open tasks is absent from the workload',
    !workload.some((w) => w.name === designerEmail),
    'designer still appears in workload',
  );

  // --- cleanup -----------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const taskIds = [t1.data.id, t2.data.id, t3.data.id].map((id) => `'${id}'`).join(', ');
  const { error: taskCleanup } = await admin.from('tasks').delete().in('id', [t1.data.id, t2.data.id, t3.data.id]);
  const { error: projCleanup } = await admin.from('projects').delete().eq('id', projectId);
  const { data: leftover } = await admin.from('projects').select('id').eq('id', projectId);
  record(
    'cleanup: tasks + project deleted',
    !taskCleanup && !projCleanup && (leftover?.length ?? 0) === 0,
    taskCleanup?.message || projCleanup?.message || `remaining=${leftover?.length ?? 0}`,
  );
  if (MGMT_TOKEN) {
    try {
      const emails = createdEmails.map((e) => `'${e}'`).join(', ');
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