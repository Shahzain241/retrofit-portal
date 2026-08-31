/**
 * ProjectsDirectory.jsx filters + pagination verification.
 *
 * The directory's filters were fake (single static options, no onChange; the
 * HAS ISSUES toggle flipped state but never filtered; chip + Clear all static;
 * Prev/Next inert). They are now wired to REAL Supabase WHERE clauses over
 * `projects` (has_issues, status, created_at presets), the chip reflects the
 * real active-filter count and Clear all resets them, ASSIGNED TO is honestly
 * disabled ("Coming soon" — no coordinator/assignee field exists on projects),
 * and Prev/Next drive real .range() pagination.
 *
 *   PART A — source checks
 *       a1) HAS ISSUES toggle filters by the real has_issues column
 *       a2) STATUS select wired to real status values + filters
 *       a3) ASSIGNED TO honestly disabled "Coming soon" (no fake filter)
 *       a4) DATE RANGE wired to real created_at presets
 *       a5) active-filter chip reflects real count + Clear all resets filters
 *       a6) Prev/Next pagination wired (.range) + disabled at bounds
 *
 *   PART B — live checks (exact component query replicated)
 *       b1) has_issues=true filter returns only critical projects
 *       b2) status filter returns only that status
 *       b3) date-range filter (last 7 days) excludes backdated projects
 *       b4) pagination: page 1 returns ≤ PAGE_SIZE and count is the filtered total
 *       b5) no filters (clear-all state) returns all projects
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to clean up test data.
 * Usage: node scripts/verify-projectsdirectory-filters.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const URL = 'https://xxtfqjbadzfjpcdfjdxo.supabase.co';

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

const PAGE_SIZE = 10;

const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

// --- source helpers -----------------------------------------------------------
const DIR_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'admin', 'ProjectsDirectory.jsx'),
  'utf8',
);

// Mirrors the exact component fetch.
function directoryQuery(client, { hasIssues = false, status = 'All', dateRange = 'all', page = 1, pageSize = PAGE_SIZE } = {}) {
  let query = client
    .from('projects')
    .select('*, client:profiles(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (hasIssues) query = query.eq('has_issues', true);
  if (status !== 'All') query = query.eq('status', status);
  if (dateRange !== 'all') {
    const since = new Date(Date.now() - Number(dateRange) * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', since);
  }
  return query.range((page - 1) * pageSize, page * pageSize - 1);
}

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    DIR_SRC.includes("if (hasIssues) query = query.eq('has_issues', true);") &&
    DIR_SRC.includes("hasIssues ? 'Critical Only' : 'All projects'");
  record(
    'a1) HAS ISSUES toggle filters by the real has_issues column',
    a1,
    a1 ? '' : 'has-issues filter is not wired to the has_issues column',
  );

  const a2 =
    DIR_SRC.includes('Object.keys(PROJECT_STATUS)') &&
    DIR_SRC.includes("if (statusFilter !== 'All') query = query.eq('status', statusFilter);");
  record(
    'a2) STATUS select wired to real status values + filters',
    a2,
    a2 ? '' : 'status filter is not wired to real status values',
  );

  const a3 =
    DIR_SRC.includes('id="filter-assigned"') &&
    DIR_SRC.includes('disabled') &&
    DIR_SRC.includes('Coming soon') &&
    !DIR_SRC.includes('assigneeFilter');
  record(
    'a3) ASSIGNED TO honestly disabled "Coming soon" (no fake filter)',
    a3,
    a3 ? '' : 'ASSIGNED TO still looks like a working filter',
  );

  const a4 =
    DIR_SRC.includes("dateRange !== 'all'") &&
    DIR_SRC.includes("query = query.gte('created_at', since)") &&
    DIR_SRC.includes("value: '7'") &&
    DIR_SRC.includes("value: '90'");
  record(
    'a4) DATE RANGE wired to real created_at presets (7/30/90/all)',
    a4,
    a4 ? '' : 'date-range filter is not wired to created_at presets',
  );

  const a5 =
    DIR_SRC.includes('const activeFilters = [') &&
    DIR_SRC.includes('activeFilters.length === 0') &&
    DIR_SRC.includes('function clearAll()') &&
    DIR_SRC.includes('setStatusFilter(\'All\')') &&
    DIR_SRC.includes('setDateRange(\'all\')');
  record(
    'a5) chip reflects real active filter count + Clear all resets filters',
    a5,
    a5 ? '' : 'chip / Clear all are not wired to the real filter state',
  );

  const a6 =
    DIR_SRC.includes('query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)') &&
    DIR_SRC.includes('disabled={page <= 1}') &&
    DIR_SRC.includes('disabled={page >= totalPages}');
  record(
    'a6) Prev/Next drive real pagination and disable at bounds',
    a6,
    a6 ? '' : 'pagination is missing .range or bound disabling',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectIds = [
    `DIR-${stamp}-A`, // active, has_issues, now
    `DIR-${stamp}-B`, // active, no issues, now
    `DIR-${stamp}-C`, // completed, has_issues, now
    `DIR-${stamp}-D`, // active, no issues, backdated 40 days
  ];
  const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  const seeds = [
    { id: projectIds[0], name: 'Dir A', status: 'active', has_issues: true, progress: 10, address_line1: '1 A', address_city: 'London', address_postcode: 'SW1', service: 'HVAC' },
    { id: projectIds[1], name: 'Dir B', status: 'active', has_issues: false, progress: 20, address_line1: '2 B', address_city: 'London', address_postcode: 'SW1', service: 'HVAC' },
    { id: projectIds[2], name: 'Dir C', status: 'completed', has_issues: true, progress: 100, address_line1: '3 C', address_city: 'London', address_postcode: 'SW1', service: 'Insulation' },
    { id: projectIds[3], name: 'Dir D', status: 'active', has_issues: false, progress: 30, address_line1: '4 D', address_city: 'London', address_postcode: 'SW1', service: 'Insulation', created_at: oldDate },
  ];
  const seedErrs = [];
  for (const s of seeds) {
    const { error } = await admin.from('projects').insert(s);
    if (error) seedErrs.push(error.message);
  }
  record('seed: 4 test projects created', seedErrs.length === 0, seedErrs.join('; ') || projectIds.join(', '));
  const seedingOk = seedErrs.length === 0;
  if (!seedingOk) {
    recordSkipAll();
  }

  // --- b1) has_issues filter ------------------------------------------------------
  const { data: issuesRows } = await directoryQuery(admin, { hasIssues: true });
  const issuesIds = (issuesRows ?? []).map((p) => p.id);
  record(
    'b1) has_issues=true filter returns only critical projects',
    issuesIds.includes(projectIds[0]) &&
      issuesIds.includes(projectIds[2]) &&
      !issuesIds.includes(projectIds[1]) &&
      !issuesIds.includes(projectIds[3]) &&
      (issuesRows ?? []).every((p) => p.has_issues === true),
    `ids=${issuesIds.join(', ') || '(none)'}`,
  );

  // --- b2) status filter -----------------------------------------------------------
  const { data: statusRows } = await directoryQuery(admin, { status: 'completed' });
  const statusIds = (statusRows ?? []).map((p) => p.id);
  record(
    'b2) status=completed filter returns only completed projects (incl. mine)',
    statusIds.includes(projectIds[2]) &&
      (statusRows ?? []).every((p) => p.status === 'completed') &&
      !statusIds.includes(projectIds[0]),
    `ids=${statusIds.join(', ') || '(none)'}`,
  );

  // --- b3) date range filter --------------------------------------------------------
  const { data: recentRows } = await directoryQuery(admin, { dateRange: '7' });
  const recentIds = (recentRows ?? []).map((p) => p.id);
  record(
    'b3) last-7-days filter excludes the backdated project',
    recentIds.includes(projectIds[0]) &&
      recentIds.includes(projectIds[1]) &&
      recentIds.includes(projectIds[2]) &&
      !recentIds.includes(projectIds[3]),
    `ids=${recentIds.join(', ') || '(none)'}`,
  );

  // --- b4) pagination (multi-page, pageSize=2) --------------------------------------
  const collected = [];
  let totalCount = null;
  let pagesOk = true;
  for (let p = 1; ; p += 1) {
    const { data, count } = await directoryQuery(admin, { page: p, pageSize: 2 });
    if (p === 1) totalCount = count;
    const rows = data ?? [];
    if (rows.length === 0) break;
    if (rows.length > 2) pagesOk = false;
    collected.push(...rows);
  }
  const collectedIds = collected.map((r) => r.id);
  record(
    'b4) pagination: pages ≤ pageSize, sum of pages == filtered total, all seeded projects present',
    pagesOk &&
      totalCount != null &&
      collected.length === totalCount &&
      projectIds.every((id) => collectedIds.includes(id)),
    `pages-sum=${collected.length} count=${totalCount} pageSize=2`,
  );

  // --- b5) no filters (clear-all state) -----------------------------------------------
  const { data: allRows } = await directoryQuery(admin, {});
  const allIds = (allRows ?? []).map((p) => p.id);
  record(
    'b5) no filters (clear-all state) includes all seeded projects (unfiltered set)',
    allIds.length > 0 && projectIds.every((id) => allIds.includes(id)),
    `ids=${allIds.join(', ') || '(none)'}`,
  );

  // --- cleanup ---------------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: cleanupErr } = await admin.from('projects').delete().in('id', projectIds);
  const { data: leftover } = await admin.from('projects').select('id').in('id', projectIds);
  record(
    'cleanup: test projects deleted',
    !cleanupErr && (leftover?.length ?? 0) === 0,
    cleanupErr ? cleanupErr.message : `remaining=${leftover?.length ?? 0}`,
  );

  function recordSkipAll() {
    ['b1', 'b2', 'b3', 'b4', 'b5'].forEach((n) => record(`${n}) filter check`, false, 'seeding failed'));
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