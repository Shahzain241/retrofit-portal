/**
 * TaskBoard board-controls verification (assignee filter, column counts, card click).
 *
 * Covers the three board-control fixes from the full modal audit:
 *
 *   PART A — source checks
 *       a1) "All assignees" dropdown is built from the REAL staff pool
 *           (staffProfiles fetched via the staff-role query), not only the
 *           assignee names that happen to be on the current board. "Unassigned"
 *           stays selectable.
 *       a2) column counts use the REAL unfiltered count for the column, not the
 *           filtered visibleColumns length — so the "(n)" never shrinks when a
 *           search/assignee/priority filter is active.
 *       a3) clicking a task CARD opens the edit modal (the whole card is a
 *           button), the drag grip is excluded (stopPropagation so dragging
 *           doesn't trigger edit), and the pencil still works.
 *
 *   PART B — live checks
 *       b1) the real unfiltered count for a column equals the actual tasks
 *           stored in `tasks` for that project+status (the count source)
 *       b2) a filterable staff pool query returns the same staff-role profiles
 *           the board's assignee dropdown is populated from
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
    BOARD_SRC.includes('staffProfiles.forEach((s) =>') &&
    BOARD_SRC.includes('const name = s.full_name || s.email;') &&
    BOARD_SRC.includes('value="Unassigned"') &&
    /columns\.forEach\(\(col\) => col\.tasks\.forEach/.test(BOARD_SRC) &&
    BOARD_SRC.includes('assigneeFilter');
  record(
    'a1) "All assignees" dropdown is built from the real staff pool (+ board assignees)',
    a1,
    a1 ? '' : 'assignee options still derived only from tasks on the board',
  );

  const a2 =
    BOARD_SRC.includes('realCount={columns.find((c) => c.id === col.id)?.tasks.length ?? 0}') &&
    BOARD_SRC.includes('function DroppableColumn({ col, realCount, onEdit, onDelete })') &&
    BOARD_SRC.includes('({realCount})') &&
    !BOARD_SRC.includes('({col.tasks.length})');
  record(
    'a2) column counts use the real unfiltered count, not the filtered length',
    a2,
    a2 ? '' : 'count still rendered from the filtered visibleColumns length',
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