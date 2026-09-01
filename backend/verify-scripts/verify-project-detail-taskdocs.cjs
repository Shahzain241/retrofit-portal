/**
 * TaskDocs tab live-data + RLS verification.
 *
 * Confirms the TaskDocs wiring in TaskDocsTab.jsx:
 *   `.from('tasks').select('*').eq('project_id', projectId)`
 * gated by the new client RLS policy ("Clients can view own project tasks"):
 *
 *   1) a client sees ONLY tasks belonging to their own project
 *   2) RLS blocks a client from seeing tasks on another client's project
 *   3) anon has no access to tasks (0 rows)
 *   4) clients are read-only: INSERT / UPDATE / DELETE on tasks are rejected
 *      by RLS (no matching policies)
 *
 * Requires:
 *   - backend/sql/07_client_projects_select_policy.sql (client SELECT on
 *     projects + super-admin CRUD) for seeding projects
 *   - backend/sql/08_client_tasks_select_policy.sql (client SELECT on tasks)
 *   - existing backend/sql/06_tasks_rls.sql (super-admin CRUD on tasks)
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Cleanup: seeded tasks + projects are always deleted via super-admin DELETE.
 * Test auth accounts are only deleted when SUPABASE_MANAGEMENT_TOKEN is set.
 *
 * Usage: node backend/verify-scripts/verify-project-detail-taskdocs.cjs
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

// Mirrors the exact fetch used by TaskDocsTab.jsx.
function fetchTasksForProject(client, projectId) {
  return client.from('tasks').select('*').eq('project_id', projectId);
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
  const projectAId = `PDTD-${stamp}-PA`;
  const projectBId = `PDTD-${stamp}-PB`;
  const clientAEmail = `pdtd-a-${stamp}@verify.test`;
  const clientBEmail = `pdtd-b-${stamp}@verify.test`;
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

  // --- seed projects --------------------------------------------------------
  let seedingOk = true;
  for (const p of [
    { id: projectAId, name: 'TaskDoc Seed A', client_id: clientAId, status: 'active', progress: 50, address_line1: '1 A St', address_city: 'London', address_postcode: 'NW1 1AA', service: 'HVAC Retrofit' },
    { id: projectBId, name: 'TaskDoc Seed B', client_id: clientBId, status: 'active', progress: 20, address_line1: '1 B St', address_city: 'Manchester', address_postcode: 'M1 1BB', service: 'Insulation Upgrade' },
  ]) {
    const { error } = await admin.from('projects').insert(p);
    if (error) {
      seedingOk = false;
      record(`seed: super-admin created project ${p.id}`, false, error.message);
    } else {
      record(`seed: super-admin created project ${p.id}`, true, p.id);
    }
  }

  // --- seed tasks -----------------------------------------------------------
  // project A: task1 (assessment), task2 (design); project B: task3 (backlog)
  const taskSeed = [
    { title: 'Task A1', status: 'assessment', priority: 'High', project_id: projectAId },
    { title: 'Task A2', status: 'design', priority: 'Medium', project_id: projectAId },
    { title: 'Task B1', status: 'backlog', priority: 'Low', project_id: projectBId },
  ];
  if (seedingOk) {
    const { data, error } = await admin.from('tasks').insert(taskSeed).select('id, title, project_id');
    if (error) {
      seedingOk = false;
      record('seed: super-admin created 3 tasks', false, error.message);
    } else {
      record('seed: super-admin created 3 tasks', true, (data ?? []).map((t) => t.title).join(', '));
    }
  }
  if (!seedingOk) {
    console.error('\nSeeding failed — apply the policies from backend/sql/06/07/08, then re-run. ' +
      'Dependent checks below are SKIPPED.');
  }

  // --- 1) client A sees ONLY their own project's tasks ----------------------
  if (!seedingOk) {
    recordSkip('1) client A sees only their own project tasks', 'seeding failed');
  } else {
    const { data: rows, error } = await fetchTasksForProject(clientA, projectAId);
    const ok =
      !error &&
      (rows ?? []).length === 2 &&
      (rows ?? []).every((t) => t.project_id === projectAId) &&
      (rows ?? []).map((t) => t.title).includes('Task A1') &&
      (rows ?? []).map((t) => t.title).includes('Task A2');
    record(
      '1) client A sees only tasks of their own project (2 tasks)',
      ok,
      error ? error.message : `titles=${(rows ?? []).map((t) => t.title).join(', ')}`,
    );
  }

  // --- 2) RLS blocks seeing another client's project tasks -------------------
  if (!seedingOk) {
    recordSkip('2) client A cannot see client B project tasks', 'seeding failed');
    recordSkip('2) client B cannot see client A project tasks', 'seeding failed');
  } else {
    const aReadsB = await fetchTasksForProject(clientA, projectBId);
    record(
      '2) client A cannot see tasks of client B project (0 rows)',
      (aReadsB.data ?? []).length === 0,
      aReadsB.error ? aReadsB.error.message : `rows=${aReadsB.data?.length ?? 0}`,
    );

    const bReadsA = await fetchTasksForProject(clientB, projectAId);
    record(
      '2) client B cannot see tasks of client A project (0 rows)',
      (bReadsA.data ?? []).length === 0,
      bReadsA.error ? bReadsA.error.message : `rows=${bReadsA.data?.length ?? 0}`,
    );
  }

  // --- 3) anon has no access -------------------------------------------------
  const anon = createClient(URL, ANON, CLIENT_OPTIONS);
  const anonRows = await anon.from('tasks').select('id');
  record(
    '3) anon cannot read tasks (0 rows)',
    (anonRows.data?.length ?? 0) === 0,
    `rows=${anonRows.data?.length ?? 0}`,
  );

  // --- 4) clients are read-only: INSERT / UPDATE / DELETE rejected -----------
  if (!seedingOk) {
    recordSkip('4) client INSERT task rejected', 'seeding failed');
    recordSkip('4) client UPDATE task rejected', 'seeding failed');
    recordSkip('4) client DELETE task rejected', 'seeding failed');
  } else {
    const { data: ownTasks } = await admin.from('tasks').select('id, title, status').eq('project_id', projectAId);
    const task1 = (ownTasks ?? []).find((t) => t.title === 'Task A1');

    const ins = await clientA.from('tasks').insert({ title: 'Sneaky', status: 'backlog', project_id: projectAId }).select('id');
    record(
      '4) client INSERT on tasks rejected by RLS',
      !!ins.error && (ins.data ?? []).length === 0,
      ins.error ? ins.error.message : 'no error (allowed!)',
    );

    const upd = await clientA.from('tasks').update({ status: 'done' }).eq('id', task1.id);
    const { data: afterUpd } = await admin.from('tasks').select('status').eq('id', task1.id).single();
    record(
      '4) client UPDATE on tasks has no effect',
      afterUpd?.status === task1.status,
      upd.error ? upd.error.message : `status still=${afterUpd?.status}`,
    );

    const del = await clientA.from('tasks').delete().eq('id', task1.id);
    const { data: afterDel } = await admin.from('tasks').select('id').eq('id', task1.id);
    record(
      '4) client DELETE on tasks has no effect',
      (afterDel?.length ?? 0) === 1,
      del.error ? del.error.message : `rows remaining=${afterDel?.length ?? 0}`,
    );
  }

  // --- cleanup --------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: tasksDelErr } = await admin
    .from('tasks')
    .delete()
    .in('project_id', [projectAId, projectBId]);
  const { data: leftoverTasks } = await admin
    .from('tasks')
    .select('id')
    .in('project_id', [projectAId, projectBId]);
  record(
    'cleanup: seeded tasks deleted',
    !tasksDelErr && (leftoverTasks?.length ?? 0) === 0,
    tasksDelErr ? tasksDelErr.message : `remaining=${leftoverTasks?.length ?? 0}`,
  );

  const { error: projDelErr } = await admin
    .from('projects')
    .delete()
    .in('id', [projectAId, projectBId]);
  const { data: leftoverProj } = await admin
    .from('projects')
    .select('id')
    .in('id', [projectAId, projectBId]);
  record(
    'cleanup: seeded projects deleted',
    !projDelErr && (leftoverProj?.length ?? 0) === 0,
    projDelErr ? projDelErr.message : `remaining=${leftoverProj?.length ?? 0}`,
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