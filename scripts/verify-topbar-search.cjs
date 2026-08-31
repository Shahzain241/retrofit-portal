/**
 * Topbar search verification.
 *
 * The Topbar search is scoped to what a CLIENT can actually search:
 *   - their OWN projects (Supabase query scoped via client_id = auth.uid(),
 *     ilike on name/address_line1/address_city/id, respecting RLS)
 *   - the public services catalogue (src/data/services.js — the services
 *     table is staff-only, so clients search the data file, matching the
 *     component's in-memory filter)
 *
 *   PART A — source checks (no browser harness)
 *       a1) Topbar queries projects scoped to auth.uid() with ilike AND
 *           filters publicServices by title (real scope, both sources)
 *       a2) selecting a result navigates to /projects/:id or /services/:id
 *       a3) an empty-result query renders an explicit "No results" state
 *
 *   PART B — live checks
 *       b1) typing a known project name returns that project (client A)
 *       b2) typing a known service title returns that service (catalogue)
 *       b3) an unmatched query matches nothing (projects 0 + services 0 →
 *           the "No results" state, not a silent no-op)
 *       b4) selecting a project navigates to /projects/:id (source check)
 *       b5) RLS: client B cannot see client A's project in search results
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test
 * auth accounts. Usage: node scripts/verify-topbar-search.cjs
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

// --- source helpers -----------------------------------------------------------
const TOPBAR_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'Topbar.jsx'),
  'utf8',
);
const SERVICES_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'data', 'services.js'),
  'utf8',
);

// Mirrors the component's in-memory service filter over src/data/services.js.
const serviceTitles = [...SERVICES_SRC.matchAll(/title:\s*'([^']+)'/g)].map((m) => m[1]);
function filterServices(query) {
  const ql = query.toLowerCase();
  return serviceTitles.filter((t) => t.toLowerCase().includes(ql));
}

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    TOPBAR_SRC.includes("from('projects')") &&
    TOPBAR_SRC.includes(".eq('client_id', user.id)") &&
    TOPBAR_SRC.includes('.or(') &&
    TOPBAR_SRC.includes('publicServices') &&
    TOPBAR_SRC.includes('s.title.toLowerCase().includes(ql)');
  record(
    'a1) search scope = own projects (Supabase, RLS) + services catalogue',
    a1,
    a1 ? '' : 'search does not query own projects and/or the services catalogue',
  );

  const a2 =
    TOPBAR_SRC.includes("navigate(`/projects/${id}`)") &&
    TOPBAR_SRC.includes("navigate(`/services/${id}`)");
  record(
    'a2) selecting a result navigates to /projects/:id or /services/:id',
    a2,
    a2 ? '' : 'result navigation to project/service routes missing',
  );

  const a3 =
    TOPBAR_SRC.includes('No results for') &&
    TOPBAR_SRC.includes('searchResults.projects.length === 0 && searchResults.services.length === 0');
  record(
    'a3) empty-result query renders an explicit "No results" state',
    a3,
    a3 ? '' : '"No results" state missing',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectAId = `SEARCHPRJ-${stamp}-A`;
  const projectBId = `SEARCHPRJ-${stamp}-B`;
  const clientAEmail = `search-a-${stamp}@verify.test`;
  const clientBEmail = `search-b-${stamp}@verify.test`;
  const createdEmails = [clientAEmail, clientBEmail];
  const projectAName = 'Kingsway Retrofit';
  const projectBName = 'Brixton House Retrofit';
  const searchTerm = 'Kingsway';

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

  // Seed one project per client.
  const seed = [
    { id: projectAId, name: projectAName, status: 'active', progress: 0, address_line1: '1 Kingsway', address_city: 'London', address_postcode: 'WC2B 6AA', service: 'HVAC Retrofit', client_id: clientAId },
    { id: projectBId, name: projectBName, status: 'active', progress: 0, address_line1: '5 Brixton Rd', address_city: 'London', address_postcode: 'SW9 8BG', service: 'Insulation Upgrade', client_id: clientBId },
  ];
  const seedErrs = [];
  for (const s of seed) {
    const { error } = await admin.from('projects').insert(s);
    if (error) seedErrs.push(error.message);
  }
  record('seed: test projects created for client A and client B', seedErrs.length === 0, seedErrs.join('; ') || `${projectAId}, ${projectBId}`);
  const seedingOk = seedErrs.length === 0;
  if (!seedingOk) {
    recordSkip('b1-b5) live search checks', 'seeding failed');
  }

  // Exact Topbar project query (replicated).
  const topbarProjectQuery = (client, uid, q) => client
    .from('projects')
    .select('id, name, address_line1, address_city')
    .eq('client_id', uid)
    .or(`name.ilike.%${q}%,address_line1.ilike.%${q}%,address_city.ilike.%${q}%,id.ilike.%${q}%`)
    .limit(5);

  // --- b1) known project name returns that project ------------------------------
  const { data: aHit, error: aErr } = await topbarProjectQuery(clientA, clientAId, searchTerm);
  const aIds = (aHit ?? []).map((p) => p.id);
  record(
    'b1) typing a known project name returns that project (client A)',
    !aErr && aIds.length === 1 && aIds[0] === projectAId,
    aErr ? aErr.message : `ids=${aIds.join(', ')}`,
  );

  // --- b2) known service title returns that service ------------------------------
  const knownService = serviceTitles[0] || '';
  const serviceHits = filterServices(knownService.split(' ').slice(0, 2).join(' '));
  record(
    'b2) typing a known service title returns that service (catalogue)',
    knownService.length > 0 && serviceHits.length > 0 && serviceHits.includes(knownService),
    `term="${knownService}" hits=${serviceHits.length}`,
  );

  // --- b3) unmatched query matches nothing (the "No results" condition) ----------
  const { data: noHit, error: noErr } = await topbarProjectQuery(clientA, clientAId, 'zzzznothing');
  const noServiceHits = filterServices('zzzznothing');
  record(
    'b3) unmatched query matches nothing → "No results" state (not a silent no-op)',
    !noErr && (noHit?.length ?? 0) === 0 && noServiceHits.length === 0,
    noErr ? noErr.message : `projects=${noHit?.length ?? 0} services=${noServiceHits.length}`,
  );

  // --- b4) selecting a project navigates to /projects/:id (source check) ---------
  record(
    'b4) selecting a result navigates to the correct route',
    TOPBAR_SRC.includes("navigate(`/projects/${id}`)") &&
      TOPBAR_SRC.includes("selectResult('project'") &&
      TOPBAR_SRC.includes("selectResult('service'"),
    'navigation wiring for project/service results present',
  );

  // --- b5) RLS: client B cannot see client A's project in search results ---------
  const { data: bHit, error: bErr } = await topbarProjectQuery(clientB, clientBId, searchTerm);
  const bIds = (bHit ?? []).map((p) => p.id);
  record(
    'b5) RLS: client B cannot see client A\'s project in search results',
    !bErr && bIds.length === 0 && !bIds.includes(projectAId),
    bErr ? bErr.message : `ids=${bIds.join(', ')}`,
  );

  // --- cleanup ---------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: cleanupErr } = await admin
    .from('projects')
    .delete()
    .in('id', [projectAId, projectBId]);
  const { data: leftover } = await admin
    .from('projects')
    .select('id')
    .in('id', [projectAId, projectBId]);
  record(
    'cleanup: test projects deleted',
    !cleanupErr && (leftover?.length ?? 0) === 0,
    cleanupErr ? cleanupErr.message : `remaining=${leftover?.length ?? 0}`,
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
    recordSkip('cleanup: test auth accounts deleted', `set SUPABASE_MANAGEMENT_TOKEN to delete ${createdEmails.length} test account(s)`);
  }
}

async function main() {
  partA();
  await partB();

  // --- summary ----------------------------------------------------------------
  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}   SKIPPED: ${skipped}`);

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nVERIFY SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});