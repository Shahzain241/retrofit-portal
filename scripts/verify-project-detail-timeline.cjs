/**
 * Timeline tab live-data + RLS verification.
 *
 * Confirms the Timeline wiring in TimelineTab.jsx:
 *   `.from('project_milestones').select('*').eq('project_id', project.id)
 *    .order('sort_order', { ascending: true })`
 * gated by the client RLS policy ("client can SELECT own-project milestones"):
 *
 *   1) a client fetches their own project's milestones, correctly ordered by
 *      sort_order, mapped to { id, title, date (DD/MM/YYYY or ''), state }
 *   2) cross-client fetch by project_id returns 0 rows
 *   3) anon returns 0 rows
 *   4) clients are read-only: INSERT / UPDATE / DELETE rejected by RLS
 *
 * Requires: project_milestones table + policies (client SELECT own-project,
 * super-admin full access). Demo milestone rows (project RET-DEMO-TIMELINE)
 * are NEVER touched — only rows this script creates are cleaned up.
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Usage: node scripts/verify-project-detail-timeline.cjs
 */

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

// The hosted Supabase API is intermittently slow; wrap every request with a
// timeout + retries so a single stalled call cannot hang the whole run.
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

// Mirrors the exact fetch + mapping used by TimelineTab.jsx.
async function fetchMilestones(client, projectId) {
  return client
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });
}

function formatMilestoneDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function mapMilestone(m) {
  return {
    id: m.id,
    title: m.title,
    date: m.due_date ? formatMilestoneDate(m.due_date) : '',
    state: m.state,
  };
}

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

async function main() {
  const stamp = Date.now().toString(36);
  const projectAId = `PDTL-${stamp}-PA`;
  const projectBId = `PDTL-${stamp}-PB`;
  const clientAEmail = `pdlt-a-${stamp}@verify.test`;
  const clientBEmail = `pdlt-b-${stamp}@verify.test`;
  const createdEmails = [clientAEmail, clientBEmail];

  // --- super-admin session --------------------------------------------------
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

  // --- create two client-role test accounts ---------------------------------
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

  // --- seed projects --------------------------------------------------------
  let seedingOk = true;
  for (const p of [
    { id: projectAId, name: 'Timeline Seed A', client_id: clientAId, status: 'active', progress: 50, address_line1: '1 A St', address_city: 'London', address_postcode: 'NW1 1AA', service: 'HVAC Retrofit' },
    { id: projectBId, name: 'Timeline Seed B', client_id: clientBId, status: 'active', progress: 20, address_line1: '1 B St', address_city: 'Manchester', address_postcode: 'M1 1BB', service: 'Insulation Upgrade' },
  ]) {
    const { error } = await admin.from('projects').insert(p);
    if (error) {
      seedingOk = false;
      record(`seed: super-admin created project ${p.id}`, false, error.message);
    } else {
      record(`seed: super-admin created project ${p.id}`, true, p.id);
    }
  }

  // --- seed milestones (project A: 4 rows inserted out of order) ------------
  if (seedingOk) {
    // Inserted deliberately out of sort_order to prove the fetch re-orders.
    const msSeed = [
      { project_id: projectAId, title: 'Purchase Completed', sort_order: 1, due_date: '2026-12-12', state: 'done' },
      { project_id: projectAId, title: 'Installation', sort_order: 4, due_date: null, state: 'upcoming' },
      { project_id: projectAId, title: 'Survey', sort_order: 3, due_date: null, state: 'current' },
      { project_id: projectAId, title: 'Assessment', sort_order: 2, due_date: '2026-12-12', state: 'done' },
      { project_id: projectBId, title: 'B Milestone', sort_order: 1, due_date: null, state: 'upcoming' },
    ];
    const { data, error } = await admin.from('project_milestones').insert(msSeed).select('id, title');
    if (error) {
      seedingOk = false;
      record('seed: super-admin created 5 milestone rows', false, error.message);
    } else {
      record('seed: super-admin created 5 milestone rows', true, (data ?? []).map((m) => m.title).join(', '));
    }
  }
  if (!seedingOk) {
    console.error('\nSeeding failed — apply the project_milestones policies, then re-run. ' +
      'Dependent checks below are SKIPPED.');
  }

  // --- 1) client A sees own milestones, ordered by sort_order, mapped --------
  if (!seedingOk) {
    recordSkip('1) client A fetches own milestones ordered by sort_order', 'seeding failed');
    recordSkip('1) mapping matches DB (title/date/state)', 'seeding failed');
  } else {
    const { data: rows, error } = await fetchMilestones(clientA, projectAId);
    const mapped = (rows ?? []).map(mapMilestone);

    const orderOk =
      !error &&
      mapped.map((m) => m.title).join('|') === 'Purchase Completed|Assessment|Survey|Installation';
    record(
      '1) client A fetches own milestones ordered by sort_order',
      orderOk,
      error ? error.message : `titles=${mapped.map((m) => m.title).join(' | ')}`,
    );

    const mappingOk =
      orderOk &&
      mapped[0].date === '12/12/2026' &&
      mapped[0].state === 'done' &&
      mapped[1].date === '12/12/2026' &&
      mapped[1].state === 'done' &&
      mapped[2].date === '' &&
      mapped[2].state === 'current' &&
      mapped[3].date === '' &&
      mapped[3].state === 'upcoming' &&
      (mapped[0].id && mapped[1].id && mapped[2].id && mapped[3].id);
    record(
      '1) mapping matches DB (title/date DD-MM-YYYY or blank/state)',
      mappingOk,
      mappingOk ? 'purchase/assessment done w/ date, survey current, installation upcoming' : `got ${JSON.stringify(mapped)}`,
    );
  }

  // --- 2) cross-client fetch rejected ---------------------------------------
  if (!seedingOk) {
    recordSkip('2) client A cannot fetch client B milestones', 'seeding failed');
    recordSkip('2) client B cannot fetch client A milestones', 'seeding failed');
  } else {
    const aReadsB = await fetchMilestones(clientA, projectBId);
    record(
      '2) client A cannot fetch client B milestones (0 rows)',
      (aReadsB.data ?? []).length === 0,
      aReadsB.error ? aReadsB.error.message : `rows=${aReadsB.data?.length ?? 0}`,
    );

    const bReadsA = await fetchMilestones(clientB, projectAId);
    record(
      '2) client B cannot fetch client A milestones (0 rows)',
      (bReadsA.data ?? []).length === 0,
      bReadsA.error ? bReadsA.error.message : `rows=${bReadsA.data?.length ?? 0}`,
    );
  }

  // --- 3) anon has no access -------------------------------------------------
  const anon = createClient(URL, ANON, CLIENT_OPTIONS);
  const anonRows = await anon.from('project_milestones').select('id');
  record(
    '3) anon cannot read project_milestones (0 rows)',
    (anonRows.data?.length ?? 0) === 0,
    `rows=${anonRows.data?.length ?? 0}`,
  );

  // --- 4) clients are read-only: INSERT / UPDATE / DELETE rejected -----------
  if (!seedingOk) {
    recordSkip('4) client INSERT milestone rejected', 'seeding failed');
    recordSkip('4) client UPDATE milestone rejected', 'seeding failed');
    recordSkip('4) client DELETE milestone rejected', 'seeding failed');
  } else {
    const { data: ownMs } = await admin.from('project_milestones').select('id, title, state').eq('project_id', projectAId);
    const surveyMs = (ownMs ?? []).find((m) => m.title === 'Survey');

    const ins = await clientA.from('project_milestones').insert({ project_id: projectAId, title: 'Sneaky', sort_order: 99, state: 'upcoming' }).select('id');
    record(
      '4) client INSERT on project_milestones rejected by RLS',
      !!ins.error && (ins.data ?? []).length === 0,
      ins.error ? ins.error.message : 'no error (allowed!)',
    );

    const upd = await clientA.from('project_milestones').update({ state: 'done' }).eq('id', surveyMs.id);
    const { data: afterUpd } = await admin.from('project_milestones').select('state').eq('id', surveyMs.id).single();
    record(
      '4) client UPDATE on project_milestones has no effect',
      afterUpd?.state === surveyMs.state,
      upd.error ? upd.error.message : `state still=${afterUpd?.state}`,
    );

    const del = await clientA.from('project_milestones').delete().eq('id', surveyMs.id);
    const { data: afterDel } = await admin.from('project_milestones').select('id').eq('id', surveyMs.id);
    record(
      '4) client DELETE on project_milestones has no effect',
      (afterDel?.length ?? 0) === 1,
      del.error ? del.error.message : `rows remaining=${afterDel?.length ?? 0}`,
    );
  }

  // --- cleanup (ONLY this script's rows; demo project untouched) -------------
  console.log('\n--- cleanup ---');
  const { error: msDelErr } = await admin
    .from('project_milestones')
    .delete()
    .in('project_id', [projectAId, projectBId]);
  const { data: leftoverMs } = await admin
    .from('project_milestones')
    .select('id')
    .in('project_id', [projectAId, projectBId]);
  record(
    'cleanup: script-created milestone rows deleted',
    !msDelErr && (leftoverMs?.length ?? 0) === 0,
    msDelErr ? msDelErr.message : `remaining=${leftoverMs?.length ?? 0}`,
  );

  const { error: projDelErr } = await admin
    .from('projects')
    .delete()
    .in('id', [projectAId, projectBId]);
  const { data: leftoverProj } = await admin
    .from('projects')
    .select('id')
    .in('id', [projectAId, projectBId]);
  record(
    'cleanup: script-created projects deleted',
    !projDelErr && (leftoverProj?.length ?? 0) === 0,
    projDelErr ? projDelErr.message : `remaining=${leftoverProj?.length ?? 0}`,
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
    console.log(`  SKIP  cleanup of auth users — set SUPABASE_MANAGEMENT_TOKEN to delete ${createdEmails.length} test account(s)`);
  }

  // --- summary ----------------------------------------------------------------
  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}   SKIPPED: ${skipped}`);
  console.log(`\nclient-role test users (left in place): ${clientAEmail}, ${clientBEmail}`);
  console.log(`demo rows kept (untouched): project RET-DEMO-TIMELINE (timelinedemo-client@verify.test)`);

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nVERIFY SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});