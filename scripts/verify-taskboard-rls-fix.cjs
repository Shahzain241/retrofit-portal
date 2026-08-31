/**
 * TaskBoard RLS-silent-update fix verification.
 *
 * Context: dragging/editing a task in TaskBoard.jsx used `update().eq('id', ...)`
 * WITHOUT checking how many rows were affected. When RLS silently filters the row
 * out (a staff-role user updating a task not assigned to them), Supabase returns
 * 0 rows with NO error — so the UI optimistically kept the move and looked
 * successful even though nothing persisted.
 *
 * The fix (RLS scope kept narrow — staff update only tasks assigned to them):
 *   persistStatusChange (drag) and handleEditSave (Edit -> Save) now call
 *   `.select('id')` on the UPDATE and check `(data ?? []).length === 0`; on 0
 *   rows they revert the optimistic move (drag) / keep the modal open (edit)
 *   and show a real error toast instead of silently succeeding.
 *
 *   PART A — source checks
 *       a1) persistStatusChange detects 0 affected rows and reverts + toasts
 *       a2) handleEditSave detects 0 affected rows and toasts (no false success)
 *
 *   PART B — live checks
 *       b1) super-admin can still update ANY task (1 row returned)
 *       b2) a staff user with permission (own assigned task) succeeds
 *           (1 row returned — the UI would reflect it)
 *       b3) a staff user's unauthorized update of another staff's task returns
 *           0 rows (the silent case) and the row is unchanged in the DB — the
 *           exact condition the code now detects
 *       b4) client still has no access (no regression of the RLS contract)
 *
 * Requires scripts/verify-taskboard.cjs (15/15) to still pass afterwards —
 * run it separately to confirm no regression.
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to clean up test data.
 * Usage: node scripts/verify-taskboard-rls-fix.cjs
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
const TASKBOARD_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'admin', 'TaskBoard.jsx'),
  'utf8',
);

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    TASKBOARD_SRC.includes('.update({ status: newStatus })') &&
    TASKBOARD_SRC.includes(".eq('id', taskId)") &&
    TASKBOARD_SRC.includes(".select('id')") &&
    TASKBOARD_SRC.includes('(data ?? []).length === 0') &&
    TASKBOARD_SRC.includes('revertTaskMove(taskId, newStatus, sourceStatus)') &&
    TASKBOARD_SRC.includes('may not have permission to move this task');
  record(
    'a1) persistStatusChange detects 0 affected rows → reverts + error toast',
    a1,
    a1 ? '' : 'drag persist path is missing the 0-rows check / revert / error toast',
  );

  const a2 =
    TASKBOARD_SRC.includes('handleEditSave') &&
    TASKBOARD_SRC.includes('.select(\'id\')') &&
    TASKBOARD_SRC.includes('(data ?? []).length === 0') &&
    TASKBOARD_SRC.includes('may not have permission to edit it') &&
    TASKBOARD_SRC.includes("showToast({ type: 'success', message: 'Task updated' })");
  record(
    'a2) handleEditSave detects 0 affected rows → error toast (no false success)',
    a2,
    a2 ? '' : 'edit-save path is missing the 0-rows check / error toast',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectId = `RLSFIX-${stamp}`;
  const staffAEmail = `rlsfix-a-${stamp}@verify.test`;
  const staffBEmail = `rlsfix-b-${stamp}@verify.test`;
  const clientEmail = `rlsfix-c-${stamp}@verify.test`;
  const createdEmails = [staffAEmail, staffBEmail, clientEmail];

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  // seed a project so tasks have a valid parent
  const { error: projSeedErr } = await admin.from('projects').insert({
    id: projectId,
    name: 'RLS Fix Seed',
    status: 'active',
    progress: 0,
    address_line1: '1 Fix St',
    address_city: 'London',
    address_postcode: 'SW1A 1AA',
    service: 'HVAC Retrofit',
  });
  if (projSeedErr) throw new Error(`project seed: ${projSeedErr.message}`);

  async function createUser(email, roleKey) {
    const {
      data: { session },
    } = await admin.auth.getSession();
    const password = tempPassword();
    const { data, error } = await admin.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (session) {
      await admin.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    }
    if (roleKey) {
      const { error: roleErr } = await admin.from('profiles').update({ role: roleKey }).eq('id', data.user.id);
      if (roleErr) return { error: roleErr.message };
    }
    return { id: data.user.id, password };
  }

  const staffA = await createUser(staffAEmail, 'coordinator');
  const staffB = await createUser(staffBEmail, 'designer');
  const clientAcc = await createUser(clientEmail, null);
  if (staffA.error || staffB.error || clientAcc.error) {
    throw new Error(`account setup failed: ${staffA.error || staffB.error || clientAcc.error}`);
  }
  console.log('setup: coordinator + designer + client created');

  const tA = await admin.from('tasks').insert({
    title: 'RLS Fix A', priority: 'High', status: 'backlog', assignee_id: staffA.id, project_id: projectId, tags: [],
  }).select('*').single();
  const tB = await admin.from('tasks').insert({
    title: 'RLS Fix B', priority: 'Medium', status: 'backlog', assignee_id: staffB.id, project_id: projectId, tags: [],
  }).select('*').single();
  if (tA.error || tB.error) throw new Error(`task create failed: ${tA.error?.message || tB.error?.message}`);
  console.log('setup: 2 tasks created on', projectId);

  const staffAClient = createClient(URL, ANON);
  const { error: staffALogin } = await staffAClient.auth.signInWithPassword({ email: staffAEmail, password: staffA.password });
  if (staffALogin) throw new Error(`staffA login: ${staffALogin.message}`);

  // --- b1) super-admin can still update ANY task (1 row) -------------------------
  const adminUpd = await admin.from('tasks').update({ status: 'design' }).eq('id', tB.data.id).select('id');
  record(
    'b1) super-admin can still update any task (1 row returned)',
    !adminUpd.error && (adminUpd.data ?? []).length === 1,
    adminUpd.error?.message || `rows=${adminUpd.data?.length ?? 0}`,
  );

  // --- b2) staff with permission (own task) succeeds -------------------------------
  const staffAOwn = await staffAClient.from('tasks').update({ status: 'assessment' }).eq('id', tA.data.id).select('id');
  const { data: tAAfter } = await admin.from('tasks').select('status').eq('id', tA.data.id).single();
  record(
    'b2) staff can update their OWN task (1 row returned; DB reflects it)',
    !staffAOwn.error && (staffAOwn.data ?? []).length === 1 && tAAfter?.status === 'assessment',
    staffAOwn.error?.message || `rows=${staffAOwn.data?.length ?? 0} status=${tAAfter?.status}`,
  );

  // --- b3) staff unauthorized update returns 0 rows; DB unchanged -------------------
  const staffAOther = await staffAClient.from('tasks').update({ status: 'done' }).eq('id', tB.data.id).select('id');
  const { data: tBAfter } = await admin.from('tasks').select('status').eq('id', tB.data.id).single();
  record(
    'b3) staff unauthorized update returns 0 rows (silent case the code now detects)',
    !staffAOther.error && (staffAOther.data ?? []).length === 0 && tBAfter?.status === 'design',
    staffAOther.error?.message || `rows=${staffAOther.data?.length ?? 0} status=${tBAfter?.status}`,
  );

  // --- b4) client still has no access (RLS contract intact) ---------------------------
  const client = createClient(URL, ANON);
  const { error: clientLogin } = await client.auth.signInWithPassword({ email: clientEmail, password: clientAcc.password });
  if (clientLogin) throw new Error(`client login: ${clientLogin.message}`);
  const { data: clientTasks } = await client.from('tasks').select('id');
  record(
    'b4) client cannot read tasks (RLS contract intact)',
    (clientTasks?.length ?? 0) === 0,
    `rows=${clientTasks?.length ?? 0}`,
  );

  // --- cleanup ------------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      const taskIds = [tA.data.id, tB.data.id].map((id) => `'${id}'`).join(', ');
      const emails = createdEmails.map((e) => `'${e}'`).join(', ');
      await runQuery(`delete from public.tasks where id in (${taskIds});`);
      await runQuery(`delete from public.projects where id = '${projectId}';`);
      await runQuery(`delete from public.profiles where email in (${emails});`);
      await runQuery(`delete from auth.users where email in (${emails});`);
      const remaining = await runQuery(`select email from auth.users where email in (${emails});`);
      record('cleanup: tasks + project + test accounts deleted', (remaining?.length ?? 0) === 0, `remaining=${remaining?.length ?? 0}`);
    } catch (e) {
      record('cleanup: tasks + project + test accounts deleted', false, e.message);
    }
  } else {
    console.log('  SKIP  cleanup — set SUPABASE_MANAGEMENT_TOKEN to delete created data');
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