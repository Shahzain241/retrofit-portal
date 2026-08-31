/**
 * Deliverables tab live-data + RLS verification.
 *
 * Confirms the Deliverables wiring in DeliverablesTab.jsx:
 *   `.from('project_deliverables').select('*').eq('project_id', project.id)
 *    .order('sort_order', { ascending: true })`
 * gated by the client RLS policy ("client can SELECT own-project deliverables"):
 *
 *   1) a client fetches their own project's deliverables, correctly ordered by
 *      sort_order, mapped to { id, title, desc: description, icon: file_type,
 *      ready }
 *   2) cross-client fetch by project_id returns 0 rows
 *   3) anon returns 0 rows
 *   4) clients are read-only: INSERT / UPDATE / DELETE rejected by RLS
 *
 * Requires: project_deliverables table + policies (client SELECT own-project,
 * super-admin full access). Demo deliverable rows (project RET-DEMO-TIMELINE)
 * are NEVER touched — only rows this script creates are cleaned up.
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Usage: node scripts/verify-project-detail-deliverables.cjs
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

// Mirrors the exact fetch + mapping used by DeliverablesTab.jsx.
async function fetchDeliverables(client, projectId) {
  return client
    .from('project_deliverables')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });
}

function mapDeliverable(d) {
  return {
    id: d.id,
    title: d.title,
    desc: d.description,
    icon: d.file_type,
    ready: d.ready,
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
  const projectAId = `PDLV-${stamp}-PA`;
  const projectBId = `PDLV-${stamp}-PB`;
  const clientAEmail = `pdlv-a-${stamp}@verify.test`;
  const clientBEmail = `pdlv-b-${stamp}@verify.test`;
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
    { id: projectAId, name: 'Deliv Seed A', client_id: clientAId, status: 'active', progress: 50, address_line1: '1 A St', address_city: 'London', address_postcode: 'NW1 1AA', service: 'HVAC Retrofit' },
    { id: projectBId, name: 'Deliv Seed B', client_id: clientBId, status: 'active', progress: 20, address_line1: '1 B St', address_city: 'Manchester', address_postcode: 'M1 1BB', service: 'Insulation Upgrade' },
  ]) {
    const { error } = await admin.from('projects').insert(p);
    if (error) {
      seedingOk = false;
      record(`seed: super-admin created project ${p.id}`, false, error.message);
    } else {
      record(`seed: super-admin created project ${p.id}`, true, p.id);
    }
  }

  // --- seed deliverables (project A: 3 rows, inserted out of order) ---------
  if (seedingOk) {
    const dlvSeed = [
      { project_id: projectAId, title: 'Technical Survey Report', description: 'In progress • Est. July 5th', file_type: 'doc', ready: false, sort_order: 3 },
      { project_id: projectAId, title: 'EPC Pre-Retrofit Report', description: 'Baseline energy performance certificate.', file_type: 'pdf', ready: true, sort_order: 1 },
      { project_id: projectAId, title: 'Funding Assessment #V2', description: 'ECO4 contribution breakdown.', file_type: 'xls', ready: true, sort_order: 2 },
      { project_id: projectBId, title: 'B Deliverable', description: 'Other client row.', file_type: 'pdf', ready: true, sort_order: 1 },
    ];
    const { data, error } = await admin.from('project_deliverables').insert(dlvSeed).select('id, title');
    if (error) {
      seedingOk = false;
      record('seed: super-admin created 4 deliverable rows', false, error.message);
    } else {
      record('seed: super-admin created 4 deliverable rows', true, (data ?? []).map((d) => d.title).join(', '));
    }
  }
  if (!seedingOk) {
    console.error('\nSeeding failed — apply the project_deliverables policies, then re-run. ' +
      'Dependent checks below are SKIPPED.');
  }

  // --- 1) client A sees own deliverables, ordered by sort_order, mapped -------
  if (!seedingOk) {
    recordSkip('1) client A fetches own deliverables ordered by sort_order', 'seeding failed');
    recordSkip('1) mapping matches DB (title/desc/icon/ready)', 'seeding failed');
  } else {
    const { data: rows, error } = await fetchDeliverables(clientA, projectAId);
    const mapped = (rows ?? []).map(mapDeliverable);
    const orderOk =
      !error &&
      mapped.map((d) => d.title).join('|') === 'EPC Pre-Retrofit Report|Funding Assessment #V2|Technical Survey Report';
    record(
      '1) client A fetches own deliverables ordered by sort_order',
      orderOk,
      error ? error.message : `titles=${mapped.map((d) => d.title).join(' | ')}`,
    );

    const mappingOk =
      orderOk &&
      mapped[0].desc === 'Baseline energy performance certificate.' &&
      mapped[0].icon === 'pdf' &&
      mapped[0].ready === true &&
      mapped[1].desc === 'ECO4 contribution breakdown.' &&
      mapped[1].icon === 'xls' &&
      mapped[1].ready === true &&
      mapped[2].desc === 'In progress • Est. July 5th' &&
      mapped[2].icon === 'doc' &&
      mapped[2].ready === false &&
      (mapped[0].id && mapped[1].id && mapped[2].id);
    record(
      '1) mapping matches DB (title/desc/icon/ready)',
      mappingOk,
      mappingOk ? 'pdf/xls/doc + ready true/true/false mapped correctly' : `got ${JSON.stringify(mapped)}`,
    );
  }

  // --- 2) cross-client fetch rejected ---------------------------------------
  if (!seedingOk) {
    recordSkip('2) client A cannot fetch client B deliverables', 'seeding failed');
    recordSkip('2) client B cannot fetch client A deliverables', 'seeding failed');
  } else {
    const aReadsB = await fetchDeliverables(clientA, projectBId);
    record(
      '2) client A cannot fetch client B deliverables (0 rows)',
      (aReadsB.data ?? []).length === 0,
      aReadsB.error ? aReadsB.error.message : `rows=${aReadsB.data?.length ?? 0}`,
    );

    const bReadsA = await fetchDeliverables(clientB, projectAId);
    record(
      '2) client B cannot fetch client A deliverables (0 rows)',
      (bReadsA.data ?? []).length === 0,
      bReadsA.error ? bReadsA.error.message : `rows=${bReadsA.data?.length ?? 0}`,
    );
  }

  // --- 3) anon has no access -------------------------------------------------
  const anon = createClient(URL, ANON, CLIENT_OPTIONS);
  const anonRows = await anon.from('project_deliverables').select('id');
  record(
    '3) anon cannot read project_deliverables (0 rows)',
    (anonRows.data?.length ?? 0) === 0,
    `rows=${anonRows.data?.length ?? 0}`,
  );

  // --- 4) clients are read-only: INSERT / UPDATE / DELETE rejected -----------
  if (!seedingOk) {
    recordSkip('4) client INSERT deliverable rejected', 'seeding failed');
    recordSkip('4) client UPDATE deliverable rejected', 'seeding failed');
    recordSkip('4) client DELETE deliverable rejected', 'seeding failed');
  } else {
    const { data: ownDlv } = await admin.from('project_deliverables').select('id, title, ready').eq('project_id', projectAId);
    const epc = (ownDlv ?? []).find((d) => d.title === 'EPC Pre-Retrofit Report');

    const ins = await clientA.from('project_deliverables').insert({ project_id: projectAId, title: 'Sneaky', description: 'x', file_type: 'pdf', ready: true, sort_order: 99 }).select('id');
    record(
      '4) client INSERT on project_deliverables rejected by RLS',
      !!ins.error && (ins.data ?? []).length === 0,
      ins.error ? ins.error.message : 'no error (allowed!)',
    );

    const upd = await clientA.from('project_deliverables').update({ ready: false }).eq('id', epc.id);
    const { data: afterUpd } = await admin.from('project_deliverables').select('ready').eq('id', epc.id).single();
    record(
      '4) client UPDATE on project_deliverables has no effect',
      afterUpd?.ready === epc.ready,
      upd.error ? upd.error.message : `ready still=${afterUpd?.ready}`,
    );

    const del = await clientA.from('project_deliverables').delete().eq('id', epc.id);
    const { data: afterDel } = await admin.from('project_deliverables').select('id').eq('id', epc.id);
    record(
      '4) client DELETE on project_deliverables has no effect',
      (afterDel?.length ?? 0) === 1,
      del.error ? del.error.message : `rows remaining=${afterDel?.length ?? 0}`,
    );
  }

  // --- cleanup (ONLY this script's rows; demo project untouched) -------------
  console.log('\n--- cleanup ---');
  const { error: dlvDelErr } = await admin
    .from('project_deliverables')
    .delete()
    .in('project_id', [projectAId, projectBId]);
  const { data: leftoverDlv } = await admin
    .from('project_deliverables')
    .select('id')
    .in('project_id', [projectAId, projectBId]);
  record(
    'cleanup: script-created deliverable rows deleted',
    !dlvDelErr && (leftoverDlv?.length ?? 0) === 0,
    dlvDelErr ? dlvDelErr.message : `remaining=${leftoverDlv?.length ?? 0}`,
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