/**
 * TaskBoard / tasks-table RLS + CRUD verification.
 *
 * Confirms:
 *   - Super-admin: full CRUD on tasks
 *   - Staff (coordinator/designer/assessor): read only their own assigned tasks,
 *     update status of their own tasks; cannot reassign / delete / insert
 *   - Client: zero access
 *
 * Setup creates one coordinator, one designer and one client account, plus a
 * handful of tasks on the real project RET-2026-0101. Cleanup deletes the
 * tasks and the test accounts via the Management API (SUPABASE_MANAGEMENT_TOKEN).
 *
 * Usage: node backend/verify-scripts/verify-taskboard.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const URL = 'https://xxtfqjbadzfjpcdfjdxo.supabase.co';
const REF = 'xxtfqjbadzfjpcdfjdxo';
const PROJECT_ID = 'RET-2026-0101';

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

async function main() {
  const stamp = Date.now().toString(36);
  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  const taskIds = [];

  // --- create test accounts (signUp + role assignment via the admin session) --
  async function createUser(email, roleKey) {
    const {
      data: { session },
    } = await admin.auth.getSession();
    const password = tempPassword();
    const { data, error } = await admin.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (session) {
      const { error: restoreErr } = await admin.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (restoreErr) return { error: restoreErr.message };
    }
    if (roleKey) {
      const { error: roleErr } = await admin.from('profiles').update({ role: roleKey }).eq('id', data.user.id);
      if (roleErr) return { error: roleErr.message };
    }
    return { id: data.user.id, password };
  }

  const staffA = await createUser(`tb-staffa-${stamp}@verify.test`, 'coordinator');
  const staffB = await createUser(`tb-staffb-${stamp}@verify.test`, 'designer');
  const clientAcc = await createUser(`tb-client-${stamp}@verify.test`, null);
  if (staffA.error || staffB.error || clientAcc.error) {
    throw new Error(`account setup failed: ${staffA.error || staffB.error || clientAcc.error}`);
  }
  console.log('setup: coordinator + designer + client created');

  // --- create tasks as super-admin --------------------------------------------
  async function createTask(fields) {
    const { data, error } = await admin.from('tasks').insert(fields).select('*').single();
    return { data, error };
  }
  const t1 = await createTask({ title: 'Verify A', priority: 'High', status: 'backlog', assignee_id: staffA.id, project_id: PROJECT_ID, tags: [] });
  const t2 = await createTask({ title: 'Verify B', priority: 'Medium', status: 'assessment', assignee_id: staffB.id, project_id: PROJECT_ID, tags: [] });
  const t3 = await createTask({ title: 'Verify C', priority: 'Low', status: 'done', project_id: PROJECT_ID, tags: [] });
  const t4 = await createTask({ title: 'Verify D', priority: 'High', status: 'qa', assignee_id: staffA.id, project_id: PROJECT_ID, tags: [] });
  if (t1.error || t2.error || t3.error || t4.error) {
    throw new Error(`task create failed: ${t1.error?.message || t2.error?.message || t3.error?.message || t4.error?.message}`);
  }
  [t1, t2, t3, t4].forEach((t) => taskIds.push(t.data.id));
  console.log('setup: 4 tasks created on', PROJECT_ID);

  // --- 1) super-admin full CRUD ------------------------------------------------
  const { data: allTasks, error: allTasksErr } = await admin.from('tasks').select('id').eq('project_id', PROJECT_ID);
  record('super-admin can read all tasks', !allTasksErr && (allTasks?.length ?? 0) === 4, `rows=${allTasks?.length ?? 0}`);

  const { error: updErr } = await admin.from('tasks').update({ title: 'Verify A (edited)' }).eq('id', t1.data.id);
  const { data: t1AfterUpd } = await admin.from('tasks').select('title').eq('id', t1.data.id).single();
  record('super-admin can update a task', !updErr && t1AfterUpd?.title === 'Verify A (edited)', updErr ? updErr.message : `title now: ${t1AfterUpd?.title}`);

  const { error: delErr } = await admin.from('tasks').delete().eq('id', t3.data.id);
  const { data: t3AfterDel } = await admin.from('tasks').select('id').eq('id', t3.data.id);
  record('super-admin can delete a task', !delErr && (t3AfterDel?.length ?? 0) === 0, delErr ? delErr.message : 'row gone');
  const remainingIds = taskIds.filter((id) => id !== t3.data.id);

  // --- 2) staff RLS --------------------------------------------------------------
  const staffAClient = createClient(URL, ANON);
  const { error: staffALogin } = await staffAClient.auth.signInWithPassword({ email: `tb-staffa-${stamp}@verify.test`, password: staffA.password });
  if (staffALogin) throw new Error(`staffA login: ${staffALogin.message}`);

  const { data: staffATasks, error: staffAReadErr } = await staffAClient.from('tasks').select('id');
  const staffAIds = (staffATasks ?? []).map((r) => r.id);
  record(
    'staff reads only their own assigned tasks',
    !staffAReadErr && staffAIds.length === 2 && staffAIds.includes(t1.data.id) && staffAIds.includes(t4.data.id) && !staffAIds.includes(t2.data.id),
    `visible ids: ${staffAIds.join(', ') || '(none)'}`,
  );

  const { error: staffAStatusErr } = await staffAClient.from('tasks').update({ status: 'design' }).eq('id', t1.data.id);
  const { data: t1Status } = await admin.from('tasks').select('status').eq('id', t1.data.id).single();
  record('staff can update status of their own task', !staffAStatusErr && t1Status?.status === 'design', staffAStatusErr ? staffAStatusErr.message : `status now: ${t1Status?.status}`);

  const { error: reassignErr } = await staffAClient.from('tasks').update({ assignee_id: staffB.id }).eq('id', t1.data.id);
  const { data: t1Assignee } = await admin.from('tasks').select('assignee_id').eq('id', t1.data.id).single();
  record(
    'staff cannot reassign their task',
    !!reassignErr && t1Assignee?.assignee_id === staffA.id,
    `error: ${reassignErr ? reassignErr.message : 'none (allowed!)'} assignee_id=${t1Assignee?.assignee_id}`,
  );

  const { error: staffAOtherErr } = await staffAClient.from('tasks').update({ status: 'done' }).eq('id', t2.data.id);
  const { data: t2Status } = await admin.from('tasks').select('status').eq('id', t2.data.id).single();
  record('staff cannot update another staff member\u2019s task', (t2Status?.status ?? null) === 'assessment', `t2 status still: ${t2Status?.status}`);

  const { error: staffADelErr } = await staffAClient.from('tasks').delete().eq('id', t1.data.id);
  const { data: t1Exists } = await admin.from('tasks').select('id').eq('id', t1.data.id);
  record('staff cannot delete tasks', !staffADelErr && (t1Exists?.length ?? 0) === 1, `t1 still present: ${t1Exists?.length ?? 0}`);

  const { error: staffAInsertErr } = await staffAClient.from('tasks').insert({ title: 'x', priority: 'Low', status: 'backlog', project_id: PROJECT_ID });
  record('staff cannot insert tasks', !!staffAInsertErr, staffAInsertErr ? staffAInsertErr.message : 'no error (allowed!)');

  const staffBClient = createClient(URL, ANON);
  const { error: staffBLogin } = await staffBClient.auth.signInWithPassword({ email: `tb-staffb-${stamp}@verify.test`, password: staffB.password });
  if (staffBLogin) throw new Error(`staffB login: ${staffBLogin.message}`);
  const { data: staffBTasks } = await staffBClient.from('tasks').select('id');
  const staffBIds = (staffBTasks ?? []).map((r) => r.id);
  record('staffB reads only their own task', staffBIds.length === 1 && staffBIds.includes(t2.data.id), `visible ids: ${staffBIds.join(', ') || '(none)'}`);

  // --- 3) client RLS --------------------------------------------------------------
  const client = createClient(URL, ANON);
  const { error: clientLogin } = await client.auth.signInWithPassword({ email: `tb-client-${stamp}@verify.test`, password: clientAcc.password });
  if (clientLogin) throw new Error(`client login: ${clientLogin.message}`);

  const { data: clientTasks } = await client.from('tasks').select('id');
  record('client cannot read tasks', (clientTasks?.length ?? 0) === 0, `rows=${clientTasks?.length ?? 0}`);

  const { error: clientInsertErr } = await client.from('tasks').insert({ title: 'x', priority: 'Low', status: 'backlog', project_id: PROJECT_ID });
  record('client cannot insert tasks', !!clientInsertErr, clientInsertErr ? clientInsertErr.message : 'no error (allowed!)');

  const { error: clientUpdErr } = await client.from('tasks').update({ status: 'done' }).eq('id', t1.data.id);
  const { data: t1AfterClient } = await admin.from('tasks').select('status').eq('id', t1.data.id).single();
  record('client cannot update tasks', !clientUpdErr && (t1AfterClient?.status ?? null) === 'design', `t1 status still: ${t1AfterClient?.status}`);

  const { error: clientDelErr } = await client.from('tasks').delete().eq('id', t1.data.id);
  const { data: t1AfterClientDel } = await admin.from('tasks').select('id').eq('id', t1.data.id);
  record('client cannot delete tasks', !clientDelErr && (t1AfterClientDel?.length ?? 0) === 1, `t1 still present: ${t1AfterClientDel?.length ?? 0}`);

  // --- cleanup -------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      const ids = remainingIds.map((id) => `'${id}'`).join(', ');
      const emails = [
        `'tb-staffa-${stamp}@verify.test'`,
        `'tb-staffb-${stamp}@verify.test'`,
        `'tb-client-${stamp}@verify.test'`,
      ].join(', ');
      await runQuery(`delete from public.tasks where id in (${ids});`);
      await runQuery(`delete from public.profiles where email in (${emails});`);
      await runQuery(`delete from auth.users where email in (${emails});`);
      const remaining = await runQuery(`select email from auth.users where email in (${emails});`);
      record('cleanup: tasks + test accounts deleted', (remaining?.length ?? 0) === 0, `remaining=${remaining?.length ?? 0}`);
    } catch (e) {
      record('cleanup: tasks + test accounts deleted', false, e.message);
    }
  } else {
    console.log(`  SKIP  cleanup — set SUPABASE_MANAGEMENT_TOKEN to delete created data`);
  }

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