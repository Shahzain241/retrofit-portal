/**
 * TaskBoard task-delete verification.
 *
 * Context: the Task Board had no way to delete a task. A trash icon is now on
 * each card; clicking it opens a shared confirmation Modal (no one-click
 * deletes), and confirming runs a real DELETE on `tasks` scoped to that task.
 * RLS on `tasks` has only ONE delete policy ("Super admins can delete tasks",
 * using public.is_super_admin()) — staff have read/update-own only, so delete
 * is super-admin-only. The UI surfaces an error toast when RLS silently blocks
 * a non-super-admin (0 rows back, same detection used for drag/edit).
 *
 *   PART A — source checks
 *       a1) a delete affordance exists on the task card (Trash2 icon)
 *       a2) delete is gated behind a confirmation Modal before any DELETE
 *           fires (no one-click delete) — cancel closes without deleting
 *       a3) handleDeleteTask performs a real DELETE on `tasks` by id, checks
 *           the 0-rows RLS-silent case, and removes the card from local state
 *           so the board + column count update with no reload
 *
 *   PART B — live checks
 *       b1) super-admin DELETE removes the row from `tasks`
 *       b2) the real column count (the source the board badge renders) drops
 *           by exactly one after the delete
 *       b3) RLS: a staff (coordinator) DELETE of any task is blocked (0 rows,
 *           row still present) — delete is super-admin-only
 *       b4) RLS: a client DELETE is blocked (0 rows, row still present)
 *
 * Requires backend/sql/05_create_tasks_table.sql + 06_tasks_rls.sql (table/RLS).
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to clean up test data.
 * Usage: node backend/verify-scripts/verify-taskboard-delete.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const BOARD_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'pages', 'admin', 'TaskBoard.jsx'),
  'utf8',
);

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    BOARD_SRC.includes('Trash2') &&
    BOARD_SRC.includes('onDelete(task)') &&
    BOARD_SRC.includes('aria-label={`Delete task: ${task.title}`}') &&
    BOARD_SRC.includes('<Trash2 size={14} />');
  record(
    'a1) task card has a delete affordance (Trash2 icon)',
    a1,
    a1 ? '' : 'no delete icon/trigger on the task card',
  );

  const a2 =
    BOARD_SRC.includes('const [deleteTarget, setDeleteTarget] = useState(null)') &&
    BOARD_SRC.includes('title="Delete Task"') &&
    BOARD_SRC.includes('onClick={() => setDeleteTarget(null)}') &&
    BOARD_SRC.includes('onClick={handleDeleteTask}') &&
    !/onClick=\{\(\) => handleDeleteTask\(\)\}/.test(BOARD_SRC);
  record(
    'a2) delete is gated behind a confirmation Modal (cancel closes, no one-click delete)',
    a2,
    a2 ? '' : 'delete can fire without a confirmation step',
  );

  const a3 =
    BOARD_SRC.includes("from('tasks')\n        .delete()") &&
    BOARD_SRC.includes(".eq('id', deleteTarget.id)") &&
    BOARD_SRC.includes('.select(\'id\')') &&
    BOARD_SRC.includes('(data ?? []).length === 0') &&
    BOARD_SRC.includes('may not have permission to delete it') &&
    BOARD_SRC.includes('col.tasks.filter((t) => t.id !== deleteTarget.id)');
  record(
    'a3) handleDeleteTask: real DELETE by id, 0-rows RLS check, local state removal (no reload)',
    a3,
    a3 ? '' : 'delete handler is missing the DELETE, RLS check, or local removal',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectId = `TBDELETE-${stamp}`;
  const staffAEmail = `tbdel-a-${stamp}@verify.test`;
  const clientEmail = `tbdel-c-${stamp}@verify.test`;
  const createdEmails = [staffAEmail, clientEmail];

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  const { error: projSeedErr } = await admin.from('projects').insert({
    id: projectId,
    name: 'Delete Seed',
    status: 'active',
    progress: 0,
    address_line1: '1 Delete St',
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
  const clientAcc = await createUser(clientEmail, null);
  if (staffA.error || clientAcc.error) throw new Error(`account setup failed: ${staffA.error || clientAcc.error}`);
  console.log('setup: coordinator + client created');

  // two backlog tasks so the pre/post count is distinct
  const t1 = await admin.from('tasks').insert({
    title: 'Delete A', priority: 'High', status: 'backlog', project_id: projectId, tags: [],
  }).select('*').single();
  const t2 = await admin.from('tasks').insert({
    title: 'Delete B', priority: 'Medium', status: 'backlog', assignee_id: staffA.id, project_id: projectId, tags: [],
  }).select('*').single();
  if (t1.error || t2.error) throw new Error(`task create failed: ${t1.error?.message || t2.error?.message}`);
  const taskIds = [t1.data.id, t2.data.id];
  console.log('setup: 2 backlog tasks created on', projectId);

  const countBacklog = async () => {
    const { data, error } = await admin.from('tasks').select('id').eq('project_id', projectId).eq('status', 'backlog');
    return { n: data?.length ?? 0, error };
  };

  // --- b2a) pre-delete count captured BEFORE the delete --------------------------
  const before = await countBacklog();
  record('b2a) pre-delete backlog count = 2', !before.error && before.n === 2, `n=${before.n}`);

  // --- b1) super-admin DELETE removes the row ------------------------------------
  const delResult = await admin.from('tasks').delete().eq('id', t1.data.id).select('id');
  const { data: t1After } = await admin.from('tasks').select('id').eq('id', t1.data.id);
  record(
    'b1) super-admin can delete a task (row removed)',
    !delResult.error && (delResult.data ?? []).length === 1 && (t1After?.length ?? 0) === 0,
    delResult.error?.message || `rows-back=${delResult.data?.length ?? 0} remaining=${t1After?.length ?? 0}`,
  );

  // --- b2b) the column count source drops by exactly one ---------------------------
  const after = await countBacklog();
  record(
    'b2b) column count drops by exactly one after delete (2 → 1)',
    !after.error && after.n === 1,
    `n=${after.n}`,
  );

  // --- b3) RLS: staff cannot delete any task (delete is super-admin-only) ----------
  const staffClient = createClient(URL, ANON);
  const { error: staffLogin } = await staffClient.auth.signInWithPassword({ email: staffAEmail, password: staffA.password });
  if (staffLogin) throw new Error(`staff login: ${staffLogin.message}`);
  const staffDel = await staffClient.from('tasks').delete().eq('id', t2.data.id).select('id');
  const { data: t2AfterStaff } = await admin.from('tasks').select('id').eq('id', t2.data.id);
  record(
    'b3) staff (coordinator) DELETE is blocked by RLS (0 rows, row still present)',
    !staffDel.error && (staffDel.data ?? []).length === 0 && (t2AfterStaff?.length ?? 0) === 1,
    staffDel.error?.message || `rows=${staffDel.data?.length ?? 0} remaining=${t2AfterStaff?.length ?? 0}`,
  );

  // --- b4) RLS: client cannot delete any task ---------------------------------------
  const client = createClient(URL, ANON);
  const { error: clientLogin } = await client.auth.signInWithPassword({ email: clientEmail, password: clientAcc.password });
  if (clientLogin) throw new Error(`client login: ${clientLogin.message}`);
  const clientDel = await client.from('tasks').delete().eq('id', t2.data.id).select('id');
  const { data: t2AfterClient } = await admin.from('tasks').select('id').eq('id', t2.data.id);
  record(
    'b4) client DELETE is blocked by RLS (0 rows, row still present)',
    !clientDel.error && (clientDel.data ?? []).length === 0 && (t2AfterClient?.length ?? 0) === 1,
    clientDel.error?.message || `rows=${clientDel.data?.length ?? 0} remaining=${t2AfterClient?.length ?? 0}`,
  );

  // --- cleanup -----------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      const ids = taskIds.map((id) => `'${id}'`).join(', ');
      const emails = createdEmails.map((e) => `'${e}'`).join(', ');
      await runQuery(`delete from public.tasks where id in (${ids});`);
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