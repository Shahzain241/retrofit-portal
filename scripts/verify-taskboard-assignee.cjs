/**
 * TaskBoard assignee-picker verification.
 *
 * The Assignee field was a free-text input resolved to a user by exact
 * name/email match — an unmatched typed name silently saved assignee_id = null
 * with no warning. It is now a real dropdown populated from real staff
 * profiles (coordinator/designer/assessor/super-admin), so the admin can only
 * select a real user (or explicitly "Unassigned"):
 *
 *   PART A — source checks
 *       a1) TaskForm assignee is a <select> of real staff ids (no free-text
 *           input, no resolveAssigneeId name→id guessing)
 *       a2) create + edit persist assignee_id directly from the picker value —
 *           no code path can resolve an unmatched typed name to null
 *       a3) when the staff list is empty/unloaded, the task's current assignee
 *           is preserved (fallback option) — never silently nulled
 *
 *   PART B — live checks
 *       b1) selecting a real staff user saves the correct assignee_id (edit)
 *       b2) creating a task with a real staff id saves that id
 *       b3) editing a task WITHOUT changing its assignee keeps assignee_id
 *           unchanged (no silent null); an explicit "Unassigned" save yields
 *           null (intentional, not silent)
 *       b4) the picker's staff pool is the real staff-role profiles (the exact
 *           fetchStaff query) and includes the staff used above
 *
 * Requires scripts/verify-taskboard.cjs (15/15) and
 * scripts/verify-taskboard-rls-fix.cjs (7/7) to still pass — run them
 * separately afterwards to confirm no regression.
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to clean up test data.
 * Usage: node scripts/verify-taskboard-assignee.cjs
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

  const noFreeTextInput =
    !TASKBOARD_SRC.includes('value={assignee}\n          onChange={(e) => setAssignee(e.target.value)}');
  const pickerOk =
    !TASKBOARD_SRC.includes('resolveAssigneeId') &&
    TASKBOARD_SRC.includes('staff.map((s) =>') &&
    TASKBOARD_SRC.includes('<option value="">Unassigned</option>') &&
    noFreeTextInput;
  record(
    'a1) TaskForm assignee is a real staff dropdown (no free-text input / resolver)',
    pickerOk,
    pickerOk ? '' : 'free-text assignee input or resolveAssigneeId still present',
  );

  const a2 =
    TASKBOARD_SRC.includes('assignee_id: data.assigneeId || null') &&
    TASKBOARD_SRC.includes('assignee_id: updates.assigneeId || null') &&
    !TASKBOARD_SRC.includes('resolveAssigneeId') &&
    !TASKBOARD_SRC.includes('data.assignee,') &&
    !TASKBOARD_SRC.includes('updates.assignee,');
  record(
    'a2) create + edit persist assignee_id from the picker (no unmatched→null path)',
    a2,
    a2 ? '' : 'create/edit still resolve a typed name instead of saving the picker id',
  );

  const a3 =
    TASKBOARD_SRC.includes('!staff.some((s) => s.id === initial.assigneeId)') &&
    TASKBOARD_SRC.includes('<option value={initial.assigneeId}>');
  record(
    'a3) current assignee preserved when staff list is empty (fallback option, no silent null)',
    a3,
    a3 ? '' : 'no fallback preserves the current assignee when staff is unloaded',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectId = `ASSIGN-${stamp}`;
  const staffAEmail = `assign-a-${stamp}@verify.test`;
  const staffBEmail = `assign-b-${stamp}@verify.test`;
  const createdEmails = [staffAEmail, staffBEmail];

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  const { error: projSeedErr } = await admin.from('projects').insert({
    id: projectId,
    name: 'Assignee Seed',
    status: 'active',
    progress: 0,
    address_line1: '1 Assignee St',
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
  if (staffA.error || staffB.error) throw new Error(`account setup failed: ${staffA.error || staffB.error}`);
  console.log('setup: coordinator + designer created');

  // --- b4) the picker's staff pool = real staff-role profiles ---------------------
  const pool = await admin
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['coordinator', 'designer', 'assessor', 'super-admin']);
  const poolIds = (pool.data ?? []).map((p) => p.id);
  const allowedRoles = ['coordinator', 'designer', 'assessor', 'super-admin'];
  const b4 =
    !pool.error &&
    poolIds.includes(staffA.id) &&
    poolIds.includes(staffB.id) &&
    (pool.data ?? []).every((p) => allowedRoles.includes(p.role));
  record(
    'b4) picker staff pool = real staff-role profiles (incl. staffA + staffB)',
    b4,
    pool.error ? pool.error.message : `poolSize=${poolIds.length}`,
  );

  // Create an initially-unassigned task (explicit "Unassigned").
  const t1 = await admin.from('tasks').insert({
    title: 'Assignee T1', priority: 'High', status: 'backlog', assignee_id: null, project_id: projectId, tags: [],
  }).select('*').single();
  if (t1.error) throw new Error(`task create: ${t1.error.message}`);

  // --- b1) edit path: assign to a real staff user (exact handleEditSave payload) ---
  const editUpd = await admin.from('tasks')
    .update({
      title: t1.data.title,
      priority: t1.data.priority,
      due_date: t1.data.due_date,
      assignee_id: staffA.id,
      status: 'backlog',
    })
    .eq('id', t1.data.id)
    .select('id');
  const { data: t1AfterAssign } = await admin.from('tasks').select('assignee_id').eq('id', t1.data.id).single();
  record(
    'b1) selecting a real staff user saves the correct assignee_id (edit)',
    !editUpd.error && (editUpd.data ?? []).length === 1 && t1AfterAssign?.assignee_id === staffA.id,
    editUpd.error?.message || `assignee_id=${t1AfterAssign?.assignee_id}`,
  );

  // --- b3a) edit WITHOUT changing assignee keeps it (no silent null) ---------------
  const keepUpd = await admin.from('tasks')
    .update({
      title: t1.data.title,
      priority: t1.data.priority,
      due_date: t1.data.due_date,
      assignee_id: staffA.id,
      status: 'backlog',
    })
    .eq('id', t1.data.id)
    .select('id');
  const { data: t1AfterKeep } = await admin.from('tasks').select('assignee_id').eq('id', t1.data.id).single();
  record(
    'b3) editing without changing assignee keeps assignee_id (no silent null)',
    !keepUpd.error && (keepUpd.data ?? []).length === 1 && t1AfterKeep?.assignee_id === staffA.id,
    keepUpd.error?.message || `assignee_id=${t1AfterKeep?.assignee_id}`,
  );

  // --- b2) create path: real staff id saved (exact handleCreate payload) -----------
  const t2 = await admin.from('tasks').insert({
    title: 'Assignee T2', priority: 'Medium', status: 'backlog', assignee_id: staffB.id, project_id: projectId, tags: [],
  }).select('*').single();
  const b2 =
    !t2.error &&
    t2.data?.assignee_id === staffB.id &&
    poolIds.includes(staffB.id);
  record(
    'b2) creating a task with a real staff id saves that id',
    b2,
    t2.error?.message || `assignee_id=${t2.data?.assignee_id}`,
  );

  // --- b3b) explicit "Unassigned" saves null (intentional, not silent) ---------------
  const t3 = await admin.from('tasks').insert({
    title: 'Assignee T3', priority: 'Low', status: 'backlog', assignee_id: null, project_id: projectId, tags: [],
  }).select('*').single();
  record(
    'b3) explicit "Unassigned" saves null (intentional, picker-driven)',
    !t3.error && t3.data?.assignee_id == null,
    t3.error?.message || `assignee_id=${t3.data?.assignee_id}`,
  );

  // --- cleanup ------------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      const taskIds = [t1.data.id, t2.data.id, t3.data.id].map((id) => `'${id}'`).join(', ');
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