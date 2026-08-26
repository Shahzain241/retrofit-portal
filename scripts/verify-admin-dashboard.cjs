/**
 * Admin Dashboard live-data verification.
 *
 * Confirms that the data AdminDashboard.jsx renders matches independently
 * computed raw counts, and that the RLS layer keeps admin-only aggregates
 * (projects, services, profiles) out of anon / client-role hands while a
 * client can still read their own profile.
 *
 * Super-admin credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Usage: node scripts/verify-admin-dashboard.cjs
 */

const { createClient } = require('@supabase/supabase-js');

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

const RECENT_SIGNUP_DAYS = 7;

const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

const since = () =>
  new Date(Date.now() - RECENT_SIGNUP_DAYS * 24 * 60 * 60 * 1000).toISOString();

async function main() {
  // --- super-admin session --------------------------------------------------
  const admin = createClient(URL, ANON);
  const { error: loginErr } = await admin.auth.signInWithPassword({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
  });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);

  // --- 1) RAW counts (independent, full fetch + in-memory aggregation) ------
  const { data: allProfiles } = await admin.from('profiles').select('*');
  const { data: allProjects } = await admin.from('projects').select('*');
  const { data: allServices } = await admin.from('services').select('*');

  const rawClients = (allProfiles ?? []).filter((p) => p.role === 'client').length;
  const rawActiveServices = (allServices ?? []).filter((s) => s.status === 'active').length;
  const rawRecentSignups = (allProfiles ?? []).filter((p) => new Date(p.created_at) >= new Date(since())).length;
  const rawStatusCounts = (allProjects ?? []).reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  const rawTotalProjects = (allProjects ?? []).length;

  console.log('raw: clients=%d projects=%d (byStatus=%j) activeServices=%d recentSignups=%d',
    rawClients, rawTotalProjects, rawStatusCounts, rawActiveServices, rawRecentSignups);

  // --- 2) DASHBOARD-equivalent fetch (mirrors AdminDashboard.jsx) -----------
  const [dClients, dServices, dSignups, dProjects] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
    admin.from('services').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since()),
    admin
      .from('projects')
      .select('id, status, has_issues, due_date, address_line1, address_city, address_postcode, updated_at')
      .order('updated_at', { ascending: false }),
  ]);
  if (dClients.error || dServices.error || dSignups.error || dProjects.error) {
    throw new Error('dashboard fetch failed: ' +
      (dClients.error?.message || dServices.error?.message || dSignups.error?.message || dProjects.error?.message));
  }
  const dashboardStatusCounts = (dProjects.data ?? []).reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  console.log('dashboard: clients=%d projects=%d byStatus=%j activeServices=%d recentSignups=%d',
    dClients.count, dProjects.data?.length, dashboardStatusCounts, dServices.count, dSignups.count);

  // --- 3) ASSERT raw == dashboard -------------------------------------------
  record(
    'total clients: raw matches dashboard',
    (dClients.count ?? 0) === rawClients,
    `raw=${rawClients} dashboard=${dClients.count}`,
  );
  record(
    'active services: raw matches dashboard',
    (dServices.count ?? 0) === rawActiveServices,
    `raw=${rawActiveServices} dashboard=${dServices.count}`,
  );
  record(
    'recent signups (7d): raw matches dashboard',
    (dSignups.count ?? 0) === rawRecentSignups,
    `raw=${rawRecentSignups} dashboard=${dSignups.count}`,
  );
  const statusKeys = new Set([...Object.keys(rawStatusCounts), ...Object.keys(dashboardStatusCounts)]);
  const statusMatch = [...statusKeys].every((k) => (rawStatusCounts[k] || 0) === (dashboardStatusCounts[k] || 0));
  record(
    'projects by status: raw matches dashboard',
    statusMatch && (dProjects.data?.length ?? 0) === rawTotalProjects,
    `raw=${JSON.stringify(rawStatusCounts)} dashboard=${JSON.stringify(dashboardStatusCounts)} total=${rawTotalProjects}`,
  );

  // --- 4) RLS: anon / client cannot read admin-only aggregates ---------------
  const anon = createClient(URL, ANON);
  const anonServices = await anon.from('services').select('id');
  const anonProjects = await anon.from('projects').select('id');
  const anonProfiles = await anon.from('profiles').select('id');
  record(
    'RLS: anon cannot read services',
    (anonServices.data?.length ?? 0) === 0,
    `rows=${anonServices.data?.length ?? 0}`,
  );
  record(
    'RLS: anon cannot read projects',
    (anonProjects.data?.length ?? 0) === 0,
    `rows=${anonProjects.data?.length ?? 0}`,
  );
  record(
    'RLS: anon cannot read profiles',
    (anonProfiles.data?.length ?? 0) === 0,
    `rows=${anonProfiles.data?.length ?? 0}`,
  );

  const client = createClient(URL, ANON);
  const stamp = Date.now().toString(36);
  const clientEmail = `dashverify-${stamp}@verify.test`;
  const { data: signup, error: signupErr } = await client.auth.signUp({
    email: clientEmail,
    password: 'VerifyPass123!',
  });
  if (signupErr) throw new Error(`client signup: ${signupErr.message}`);
  console.log('setup: client-role user', clientEmail);

  const clientServices = await client.from('services').select('id');
  const clientProjects = await client.from('projects').select('id');
  record(
    'RLS: client-role cannot read services',
    (clientServices.data?.length ?? 0) === 0,
    `rows=${clientServices.data?.length ?? 0}`,
  );
  record(
    'RLS: client-role cannot read projects',
    (clientProjects.data?.length ?? 0) === 0,
    `rows=${clientProjects.data?.length ?? 0}`,
  );

  const { data: ownProfile, error: ownProfileErr } = await client
    .from('profiles')
    .select('id, role')
    .eq('id', signup.user.id);
  record(
    'RLS: client-role can still read own profile',
    !ownProfileErr && (ownProfile?.length ?? 0) === 1 && ownProfile[0].id === signup.user.id,
    ownProfileErr ? ownProfileErr.message : `rows=${ownProfile?.length ?? 0}`,
  );

  // --- summary ----------------------------------------------------------------
  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);
  console.log(`\nclient-role user (left in place): ${clientEmail}`);

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nVERIFY SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});