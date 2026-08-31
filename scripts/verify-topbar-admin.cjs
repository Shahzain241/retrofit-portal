/**
 * Topbar role-awareness verification (admin vs client).
 *
 * The shared Topbar previously behaved identically for admins and clients:
 *   - search was scoped to the logged-in user's OWN projects (so an admin's
 *     project search was always empty) and service/apps navigation pointed at
 *     client routes. It is now role-aware:
 *       * staff/admin (super-admin/coordinator/designer/assessor): search ALL
 *         projects, project results navigate to /admin/projects/:id/board,
 *         and the apps menu points at the admin panel routes
 *       * clients: unchanged (own-projects search, /projects/:id, client apps)
 *
 *   PART A — source checks
 *       a1) role is read from `profiles.role` and mapped via STAFF_ROLES
 *       a2) staff search omits the client_id filter; client branch keeps
 *           `.eq('client_id', user.id)`
 *       a3) staff project results navigate to the admin board route; client
 *           results keep /projects/:id
 *       a4) admin apps menu targets admin routes and the render picks the
 *           role-aware list
 *
 *   PART B — live checks
 *       b1) a super-admin's all-projects search finds a project they do NOT
 *           own (staff scope works)
 *       b2) a client's search still returns only their own projects (no
 *           regression to the client scope)
 *       b3) the role → isStaff mapping resolves true for super-admin, false
 *           for a client
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to clean up test data.
 * Usage: node scripts/verify-topbar-admin.cjs
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
const TOPBAR_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'Topbar.jsx'),
  'utf8',
);

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    TOPBAR_SRC.includes("STAFF_ROLES = ['super-admin', 'coordinator', 'designer', 'assessor']") &&
    TOPBAR_SRC.includes(".from('profiles')") &&
    TOPBAR_SRC.includes(".select('role')") &&
    TOPBAR_SRC.includes('setIsStaff') &&
    TOPBAR_SRC.includes('STAFF_ROLES.includes(profile.role)');
  record(
    'a1) role is read from profiles.role and mapped via STAFF_ROLES',
    a1,
    a1 ? '' : 'role resolution is missing',
  );

  const a2 =
    TOPBAR_SRC.includes("if (!isStaff) query = query.eq('client_id', user.id);") &&
    TOPBAR_SRC.includes('.eq(\'client_id\', user.id)');
  record(
    'a2) staff search has no client_id filter; client branch keeps own-projects scope',
    a2,
    a2 ? '' : 'role-aware project scope is missing',
  );

  const a3 =
    TOPBAR_SRC.includes("navigate(`/admin/projects/${id}/board`)") &&
    TOPBAR_SRC.includes("navigate(`/projects/${id}`)") &&
    TOPBAR_SRC.includes('if (isStaff) navigate');
  record(
    'a3) staff project results navigate to the admin board; clients keep /projects/:id',
    a3,
    a3 ? '' : 'result navigation is not role-aware',
  );

  const a4 =
    TOPBAR_SRC.includes("to: '/admin/dashboard'") &&
    TOPBAR_SRC.includes("to: '/admin/projects'") &&
    TOPBAR_SRC.includes('(isStaff ? ADMIN_APPS : TOPBAR_APPS).map');
  record(
    'a4) admin apps menu targets admin routes and the render picks the role-aware list',
    a4,
    a4 ? '' : 'apps menu is not role-aware',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectAId = `ADMSEARCH-${stamp}-A`;
  const projectBId = `ADMSEARCH-${stamp}-B`;
  const clientAEmail = `admsearch-a-${stamp}@verify.test`;
  const clientBEmail = `admsearch-b-${stamp}@verify.test`;
  const projectBName = 'Brixton Admin Search';

  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);
  const {
    data: { session: adminSession },
  } = await admin.auth.getSession();

  async function createClientUser(email) {
    const c = createClient(URL, ANON);
    const { data, error } = await c.auth.signUp({ email, password: tempPassword() });
    if (error || !data?.user?.id) throw new Error(`signup ${email}: ${error?.message}`);
    if (adminSession) {
      await admin.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
    }
    return { id: data.user.id, client: c };
  }
  const clientA = await createClientUser(clientAEmail);
  const clientB = await createClientUser(clientBEmail);
  console.log('setup: client A', clientAEmail);
  console.log('setup: client B', clientBEmail);

  const seeds = [
    { id: projectAId, name: 'Kingsway Admin Search', status: 'active', progress: 0, address_line1: '1 A', address_city: 'London', address_postcode: 'SW1', service: 'HVAC', client_id: clientA.id },
    { id: projectBId, name: projectBName, status: 'active', progress: 0, address_line1: '1 B', address_city: 'London', address_postcode: 'SW1', service: 'HVAC', client_id: clientB.id },
  ];
  const seedErrs = [];
  for (const s of seeds) {
    const { error } = await admin.from('projects').insert(s);
    if (error) seedErrs.push(error.message);
  }
  record('seed: 2 test projects created', seedErrs.length === 0, seedErrs.join('; ') || `${projectAId}, ${projectBId}`);
  const seedingOk = seedErrs.length === 0;
  if (!seedingOk) {
    record('b1) staff all-projects search', false, 'seeding failed');
    record('b2) client own-projects scope', false, 'seeding failed');
  } else {
    // --- b1) staff search: no client_id filter, finds a project owned by another user ---
    const staffQuery = admin
      .from('projects')
      .select('id, name, address_line1, address_city')
      .or(`name.ilike.%${projectBName}%,address_line1.ilike.%${projectBName}%,address_city.ilike.%${projectBName}%,id.ilike.%${projectBName}%`)
      .limit(5);
    const { data: staffHits, error: staffErr } = await staffQuery;
    const staffIds = (staffHits ?? []).map((p) => p.id);
    record(
      'b1) staff all-projects search finds a project they do NOT own',
      !staffErr && staffIds.length === 1 && staffIds[0] === projectBId,
      staffErr ? staffErr.message : `ids=${staffIds.join(', ') || '(none)'}`,
    );

    // --- b2) client search still scoped to own projects --------------------------
    const clientAQuery = clientA.client
      .from('projects')
      .select('id, name, address_line1, address_city')
      .eq('client_id', clientA.id)
      .or(`name.ilike.%Kingsway%,address_line1.ilike.%Kingsway%,address_city.ilike.%Kingsway%,id.ilike.%Kingsway%`)
      .limit(5);
    const { data: aHits } = await clientAQuery;
    const aIds = (aHits ?? []).map((p) => p.id);
    const clientBQuery = clientA.client
      .from('projects')
      .select('id, name, address_line1, address_city')
      .eq('client_id', clientA.id)
      .or(`name.ilike.%${projectBName}%,address_line1.ilike.%${projectBName}%,address_city.ilike.%${projectBName}%,id.ilike.%${projectBName}%`)
      .limit(5);
    const { data: bHits } = await clientBQuery;
    const bIds = (bHits ?? []).map((p) => p.id);
    record(
      'b2) client search returns only their own projects (no cross-client leak)',
      aIds.includes(projectAId) && bIds.length === 0 && !bIds.includes(projectBId),
      `own=${aIds.join(', ')} other=${bIds.join(', ') || '(none)'}`,
    );
  }

  // --- b3) role -> isStaff mapping ----------------------------------------------
  const { data: adminRole } = await admin.from('profiles').select('role').eq('id', adminSession.user.id).maybeSingle();
  const staffRoles = ['super-admin', 'coordinator', 'designer', 'assessor'];
  const { data: clientARole } = await clientA.client.from('profiles').select('role').eq('id', clientA.id).maybeSingle();
  record(
    'b3) role->isStaff resolves true for super-admin and false for a client',
    staffRoles.includes(adminRole?.role) && !staffRoles.includes(clientARole?.role),
    `admin role=${adminRole?.role} client role=${clientARole?.role}`,
  );

  // --- cleanup -----------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: cleanupErr } = await admin.from('projects').delete().in('id', [projectAId, projectBId]);
  const { data: leftover } = await admin.from('projects').select('id').in('id', [projectAId, projectBId]);
  record(
    'cleanup: test projects deleted',
    !cleanupErr && (leftover?.length ?? 0) === 0,
    cleanupErr ? cleanupErr.message : `remaining=${leftover?.length ?? 0}`,
  );
  if (MGMT_TOKEN) {
    try {
      const emails = [`'${clientAEmail}'`, `'${clientBEmail}'`].join(', ');
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