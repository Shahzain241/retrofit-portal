/**
 * TaskBoard project-title verification.
 *
 * The board header rendered a hardcoded subtitle ("High-Efficiency Heat Pump
 * Installation Cluster") under every project id — fabricated per-project data.
 * It now fetches the real `projects.name` for the active project and falls
 * back to a neutral "Task board" label when the name can't be read.
 *
 *   PART A — source checks
 *       a1) TaskBoard fetches the project name from `projects` (no hardcoded
 *           subtitle string)
 *       a2) the header falls back to a neutral label (no fabricated name)
 *
 *   PART B — live checks
 *       b1) a project with a known name round-trips through the component's
 *           query (the exact fetch TaskBoard.jsx runs)
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * Usage: node backend/verify-scripts/verify-taskboard-title.cjs
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
    BOARD_SRC.includes(".from('projects')") &&
    BOARD_SRC.includes(".select('name')") &&
    BOARD_SRC.includes(".eq('id', activeProjectId)") &&
    BOARD_SRC.includes('setProjectName') &&
    !BOARD_SRC.includes('High-Efficiency Heat Pump Installation Cluster');
  record(
    'a1) TaskBoard fetches the real project name (no hardcoded subtitle)',
    a1,
    a1 ? '' : 'hardcoded subtitle is still present or the name fetch is missing',
  );

  const a2 =
    BOARD_SRC.includes("{projectName || 'Task board'}");
  record(
    'a2) header falls back to a neutral label when the name is unavailable',
    a2,
    a2 ? '' : 'no neutral fallback for the subtitle',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectId = `TITLE-${stamp}`;
  const projectName = 'Kingsway Retrofit Title Check';

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  const { error: seedErr } = await admin.from('projects').insert({
    id: projectId,
    name: projectName,
    status: 'active',
    progress: 0,
    address_line1: '1 Title St',
    address_city: 'London',
    address_postcode: 'SW1A 1AA',
    service: 'HVAC Retrofit',
  });
  record('seed: test project created', !seedErr, seedErr ? seedErr.message : projectId);
  const seedingOk = !seedErr;

  if (seedingOk) {
    const { data, error } = await admin
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .maybeSingle();
    record(
      'b1) project name round-trips through the component query',
      !error && data?.name === projectName,
      error ? error.message : `name=${data?.name}`,
    );
  } else {
    record('b1) project name round-trips through the component query', false, 'seeding failed');
  }

  // --- cleanup -----------------------------------------------------------------
  const { error: cleanupErr } = await admin.from('projects').delete().eq('id', projectId);
  const { data: leftover } = await admin.from('projects').select('id').eq('id', projectId);
  record(
    'cleanup: test project deleted',
    !cleanupErr && (leftover?.length ?? 0) === 0,
    cleanupErr ? cleanupErr.message : `remaining=${leftover?.length ?? 0}`,
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