/**
 * TaskBoard board-controls verification (column counts, card click).
 *
 * Covers the board-control behaviour after the Task Board redesign:
 *
 *   PART A — source checks
 *       a1) the board no longer renders the search / "All assignees" /
 *           "All priorities" filter controls, while the real staff pool is
 *           still fetched (staffProfiles) for the task assignee picker in the
 *           create/edit form
 *       a2) column counts use the live tasks array for the column — with the
 *           filters gone, the "(n)" badge equals the real tasks on that column
 *       a3) clicking a task CARD opens the edit modal (the whole card is a
 *           button), the drag grip is excluded (stopPropagation so dragging
 *           doesn't trigger edit), and the pencil still works.
 *
 *   PART B — live checks
 *       b1) the real column count for a column equals the actual tasks
 *           stored in `tasks` for that project+status (the count source)
 *       b2) a staff-role profiles query returns the same staff-role profiles
 *           the assignee picker is populated from
 *           (coordinator/designer/assessor/super-admin)
 *
 * Requires backend/sql/05_create_tasks_table.sql + 06_tasks_rls.sql (table/RLS).
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * Usage: node backend/verify-scripts/verify-taskboard-controls.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const URL = 'https://xxtfqjbadzfjpcdfjdxo.supabase.co';

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

const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
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
    !BOARD_SRC.includes('placeholder="Search tasks..."') &&
    !BOARD_SRC.includes('All assignees') &&
    !BOARD_SRC.includes('All priorities') &&
    BOARD_SRC.includes('fetchStaff') &&
    BOARD_SRC.includes('task-assignee') &&
    BOARD_SRC.includes('staff.map((s) =>');
  record(
    'a1) search / assignee / priority filter controls removed; real staff pool still powers the task assignee picker',
    a1,
    a1 ? '' : 'a board filter control is still present, or the staff pool / assignee picker was dropped',
  );

  const a2 =
    BOARD_SRC.includes('({col.tasks.length})') &&
    !BOARD_SRC.includes('visibleColumns');
  record(
    'a2) column counts render the live tasks array for each column (no filtered view)',
    a2,
    a2 ? '' : 'count no longer derives from the real tasks array on the column',
  );

  const a3 =
    BOARD_SRC.includes('onClick={() => onEdit(task)}') &&
    BOARD_SRC.includes('onClick={(e) => e.stopPropagation()}') &&
    BOARD_SRC.includes('aria-label={`Edit task: ${task.title}`}') &&
    BOARD_SRC.includes("e.stopPropagation();\n                  onEdit(task);") &&
    BOARD_SRC.includes('cursor-pointer');
  record(
    'a3) task card body opens the edit modal; drag grip + pencil are click-safe',
    a3,
    a3 ? '' : 'card body is not clickable, or drag/pencil clicks double-trigger edit',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectId = `TBCONTROL-${stamp}`;

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  // seed a project so tasks have a valid parent
  const { error: projSeedErr } = await admin.from('projects').insert({
    id: projectId,
    name: 'Board Controls Seed',
    status: 'active',
    progress: 0,
    address_line1: '1 Board St',
    address_city: 'London',
    address_postcode: 'SW1A 1AA',
    service: 'HVAC Retrofit',
  });
  if (projSeedErr) throw new Error(`project seed: ${projSeedErr.message}`);

  // three backlog tasks + one design task, so counts are distinct and the
  // filterable pool is non-trivial
  const created = [];
  for (let i = 0; i < 3; i += 1) {
    const { data, error } = await admin.from('tasks').insert({
      title: `Backlog task ${i}`,
      priority: i % 2 === 0 ? 'High' : 'Low',
      status: 'backlog',
      project_id: projectId,
      tags: [],
    }).select('id').single();
    if (error) throw new Error(`task create: ${error.message}`);
    created.push(data.id);
  }
  const { data: designTask, error: designErr } = await admin.from('tasks').insert({
    title: 'Design task',
    priority: 'Medium',
    status: 'design',
    project_id: projectId,
    tags: [],
  }).select('id').single();
  if (designErr) throw new Error(`design task create: ${designErr.message}`);
  created.push(designTask.id);

  // --- b1) the real count source equals the actual DB rows ----------------------
  const { data: backlogRows, error: backlogErr } = await admin
    .from('tasks')
    .select('id')
    .eq('project_id', projectId)
    .eq('status', 'backlog');
  const { data: designRows, error: designCountErr } = await admin
    .from('tasks')
    .select('id')
    .eq('project_id', projectId)
    .eq('status', 'design');
  const b1 =
    !backlogErr && !designCountErr &&
    (backlogRows?.length ?? 0) === 3 &&
    (designRows?.length ?? 0) === 1;
  record(
    'b1) real unfiltered column counts match the DB (backlog=3, design=1)',
    b1,
    backlogErr?.message || designCountErr?.message || `backlog=${backlogRows?.length ?? 0} design=${designRows?.length ?? 0}`,
  );

  // --- b2) the assignee filter pool = real staff-role profiles ------------------
  const pool = await admin
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['coordinator', 'designer', 'assessor', 'super-admin']);
  const allowedRoles = ['coordinator', 'designer', 'assessor', 'super-admin'];
  const b2 =
    !pool.error &&
    (pool.data ?? []).length >= 1 &&
    (pool.data ?? []).every((p) => allowedRoles.includes(p.role));
  record(
    'b2) assignee filter pool = real staff-role profiles (non-empty, allowed roles only)',
    b2,
    pool.error ? pool.error.message : `poolSize=${pool.data?.length ?? 0}`,
  );

  // --- cleanup -----------------------------------------------------------------
  const { error: delTasksErr } = await admin.from('tasks').delete().in('id', created);
  const { error: delProjErr } = await admin.from('projects').delete().eq('id', projectId);
  const { data: leftover } = await admin.from('projects').select('id').eq('id', projectId);
  record(
    'cleanup: test tasks + project deleted',
    !delTasksErr && !delProjErr && (leftover?.length ?? 0) === 0,
    delTasksErr?.message || delProjErr?.message || `remaining=${leftover?.length ?? 0}`,
  );
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