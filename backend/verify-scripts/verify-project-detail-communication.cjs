/**
 * Communication tab live-data + RLS verification (two-way messaging, polling).
 *
 * Confirms the Communication wiring in CommunicationTab.jsx:
 *   `.from('project_messages').select('*').eq('project_id', project.id)
 *    .order('created_at', { ascending: true })`  (polled every 8s)
 * and the INSERT path:
 *   `.insert({ project_id, sender_id: user.id, body })`
 * gated by the RLS policy (clients SELECT/INSERT only on own projects,
 * sender_id must equal auth.uid(); staff/super-admin SELECT/INSERT anywhere):
 *
 *   1) client SELECTs own-project messages ordered by created_at
 *   2) client INSERTs a message as themselves on their own project
 *   3) client INSERT with sender_id != auth.uid() is rejected (impersonation)
 *   4) client cannot SELECT or INSERT on another client's project
 *   5) anon gets 0 rows and cannot insert
 *   6) staff/super-admin can SELECT and INSERT on the project
 *
 * Demo messages on project RET-DEMO-TIMELINE are NEVER touched — only rows
 * this script creates are cleaned up.
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Usage: node backend/verify-scripts/verify-project-detail-communication.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const URL = 'https://xxtfqjbadzfjpcdfjdxo.supabase.co';
const REF = 'xxtfqjbadzfjpcdfjdxo';

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

// Mirrors the exact fetch used by CommunicationTab.jsx.
async function fetchMessages(client, projectId) {
  return client
    .from('project_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
}

// The hosted API occasionally returns a transient 5xx (data=null). Retry the
// fetch until it yields the expected row count or we run out of attempts.
async function fetchMessagesUntil(client, projectId, expectedCount, attempts = 5) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    last = await fetchMessages(client, projectId);
    if (!last.error && (last.data ?? []).length === expectedCount) return last;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return last;
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
  const projectAId = `PMSG-${stamp}-PA`;
  const projectBId = `PMSG-${stamp}-PB`;
  const clientAEmail = `pmsg-a-${stamp}@verify.test`;
  const clientBEmail = `pmsg-b-${stamp}@verify.test`;
  const createdEmails = [clientAEmail, clientBEmail];

  // --- super-admin session --------------------------------------------------
  const admin = createClient(URL, ANON, CLIENT_OPTIONS);
  const { error: loginErr } = await admin.auth.signInWithPassword({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASSWORD,
  });
  if (loginErr) throw new Error(`super-admin login: ${loginErr.message}`);
  console.log('setup: signed in as super-admin', SUPERADMIN_EMAIL);
  const staffId = (await admin.auth.getUser()).data.user.id;
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
  console.log('setup: staff (super-admin) id', staffId);

  // --- seed projects + messages ---------------------------------------------
  let seedingOk = true;
  for (const p of [
    { id: projectAId, name: 'Chat Seed A', client_id: clientAId, status: 'active', progress: 50, address_line1: '1 A St', address_city: 'London', address_postcode: 'NW1 1AA', service: 'HVAC Retrofit' },
    { id: projectBId, name: 'Chat Seed B', client_id: clientBId, status: 'active', progress: 20, address_line1: '1 B St', address_city: 'Manchester', address_postcode: 'M1 1BB', service: 'Insulation Upgrade' },
  ]) {
    const { error } = await admin.from('projects').insert(p);
    if (error) {
      seedingOk = false;
      record(`seed: super-admin created project ${p.id}`, false, error.message);
    } else {
      record(`seed: super-admin created project ${p.id}`, true, p.id);
    }
  }

  const now = Date.now();
  const msgSeed = [
    { project_id: projectAId, sender_id: clientAId, body: 'A1 from client', created_at: new Date(now - 2 * 3600e3).toISOString() },
    { project_id: projectAId, sender_id: staffId, body: 'A2 from staff', created_at: new Date(now - 3600e3).toISOString() },
    { project_id: projectBId, sender_id: clientBId, body: 'B1 from client B', created_at: new Date(now - 3 * 3600e3).toISOString() },
  ];
  if (seedingOk) {
    const { data, error } = await admin.from('project_messages').insert(msgSeed).select('id, body');
    if (error) {
      seedingOk = false;
      record('seed: super-admin created 3 messages', false, error.message);
    } else {
      record('seed: super-admin created 3 messages', true, (data ?? []).map((m) => m.body).join(', '));
    }
  }
  if (!seedingOk) {
    console.error('\nSeeding failed — apply the project_messages policies, then re-run. ' +
      'Dependent checks below are SKIPPED.');
  }

  // --- 1) client SELECT own-project messages, ordered by created_at ----------
  if (!seedingOk) {
    recordSkip('1) client A SELECTs own-project messages ordered by created_at', 'seeding failed');
  } else {
    const { data: rows, error } = await fetchMessages(clientA, projectAId);
    const bodies = (rows ?? []).map((m) => m.body);
    const ok =
      !error &&
      bodies.length === 2 &&
      bodies[0] === 'A1 from client' &&
      bodies[1] === 'A2 from staff' &&
      (rows ?? []).every((m) => m.project_id === projectAId);
    record(
      '1) client A SELECTs own-project messages ordered by created_at',
      ok,
      error ? error.message : `bodies=${bodies.join(' | ')}`,
    );
  }

  // --- 2) client INSERT as themselves on own project -------------------------
  if (!seedingOk) {
    recordSkip('2) client A INSERTs a message as themselves', 'seeding failed');
  } else {
    const ins = await clientA.from('project_messages').insert({ project_id: projectAId, sender_id: clientAId, body: 'Hello from A' }).select('id, sender_id');
    const afterIns = await fetchMessagesUntil(clientA, projectAId, 3);
    record(
      '2) client A INSERTs a message as themselves on own project',
      !ins.error && (ins.data ?? []).length === 1 && ins.data[0].sender_id === clientAId && (afterIns.data ?? []).length === 3,
      ins.error ? ins.error.message : `rows now=${afterIns.data?.length ?? 0}${afterIns.error ? ` (err ${afterIns.error.message})` : ''}`,
    );
  }

  // --- 3) client INSERT with sender_id != auth.uid() rejected -----------------
  if (!seedingOk) {
    recordSkip('3) client INSERT with forged sender_id rejected', 'seeding failed');
  } else {
    const forge = await clientA.from('project_messages').insert({ project_id: projectAId, sender_id: clientBId, body: 'forged' }).select('id');
    record(
      '3) client INSERT with sender_id != auth.uid() rejected (impersonation)',
      !!forge.error && (forge.data ?? []).length === 0,
      forge.error ? forge.error.message : 'no error (allowed!)',
    );
  }

  // --- 4) client cannot SELECT or INSERT on another client's project ----------
  if (!seedingOk) {
    recordSkip('4) client A cannot SELECT client B messages', 'seeding failed');
    recordSkip('4) client A cannot INSERT on client B project', 'seeding failed');
  } else {
    const selB = await fetchMessages(clientA, projectBId);
    record(
      '4) client A cannot SELECT client B project messages (0 rows)',
      (selB.data ?? []).length === 0,
      selB.error ? selB.error.message : `rows=${selB.data?.length ?? 0}`,
    );

    const insB = await clientA.from('project_messages').insert({ project_id: projectBId, sender_id: clientAId, body: 'sneak' }).select('id');
    record(
      '4) client A cannot INSERT on client B project',
      !!insB.error && (insB.data ?? []).length === 0,
      insB.error ? insB.error.message : 'no error (allowed!)',
    );
  }

  // --- 5) anon gets 0 rows and cannot insert ----------------------------------
  const anon = createClient(URL, ANON, CLIENT_OPTIONS);
  const anonRows = await anon.from('project_messages').select('id');
  record(
    '5) anon cannot SELECT project_messages (0 rows)',
    (anonRows.data?.length ?? 0) === 0,
    `rows=${anonRows.data?.length ?? 0}`,
  );
  const anonIns = await anon.from('project_messages').insert({ project_id: projectAId, sender_id: staffId, body: 'anon' }).select('id');
  record(
    '5) anon cannot INSERT a message',
    !!anonIns.error && (anonIns.data ?? []).length === 0,
    anonIns.error ? anonIns.error.message : 'no error (allowed!)',
  );

  // --- 6) staff/super-admin can SELECT and INSERT on the project -------------
  if (!seedingOk) {
    recordSkip('6) staff/super-admin SELECT + INSERT on project', 'seeding failed');
  } else {
    const staffSel = await fetchMessages(admin, projectAId);
    const staffSelOk =
      !staffSel.error &&
      (staffSel.data ?? []).length === 3 &&
      (staffSel.data ?? []).every((m) => m.project_id === projectAId);
    record(
      '6) staff/super-admin can SELECT project messages (sees all 3)',
      staffSelOk,
      staffSel.error ? staffSel.error.message : `rows=${staffSel.data?.length ?? 0}`,
    );

    const staffIns = await admin.from('project_messages').insert({ project_id: projectAId, sender_id: staffId, body: 'Reply from staff' }).select('id');
    const afterStaff = await fetchMessagesUntil(admin, projectAId, 4);
    record(
      '6) staff/super-admin can INSERT on the project (count grows to 4)',
      !staffIns.error && (afterStaff.data ?? []).length === 4,
      staffIns.error ? staffIns.error.message : `rows now=${afterStaff.data?.length ?? 0}${afterStaff.error ? ` (err ${afterStaff.error.message})` : ''}`,
    );
  }

  // --- 7) tab badge == rendered thread rows (revision requests inline) --------
  if (!seedingOk) {
    recordSkip('7a) ProjectDetail badge uses a live count (no hardcoded 2)', 'seeding failed');
    recordSkip('7b) CommunicationTab renders all rows + revision tag', 'seeding failed');
    recordSkip('7c) revision_request row is rendered in the thread', 'seeding failed');
    recordSkip('7d) badge count == rendered thread rows', 'seeding failed');
  } else {
    const PROJ_SRC = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'pages', 'client', 'ProjectDetail.jsx'),
      'utf8',
    );
    const COMM_SRC = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'pages', 'client', 'project-tabs', 'CommunicationTab.jsx'),
      'utf8',
    );

    // source: badge must come from a live project_messages count, not a literal.
    const badgeLive =
      PROJ_SRC.includes("from('project_messages')") &&
      PROJ_SRC.includes('badges={{ communication: messageCount }}') &&
      !PROJ_SRC.includes('badges={{ communication: 2 }}');
    record(
      '7a) ProjectDetail badge uses a live project_messages count (no hardcoded 2)',
      badgeLive,
      badgeLive ? '' : 'ProjectDetail still hardcodes the communication badge',
    );

    // source: thread shows ALL rows (no type filter) + tags revision requests.
    const threadAllTypes =
      COMM_SRC.includes("type: m.type ?? 'message'") &&
      COMM_SRC.includes('Revision Request') &&
      !COMM_SRC.includes(".eq('type', 'message')");
    record(
      '7b) CommunicationTab renders ALL rows + tags revision requests inline',
      threadAllTypes,
      threadAllTypes ? '' : 'CommunicationTab filters by type or lacks the revision tag',
    );

    // live: add a revision request (on top of the 4 existing rows) and confirm
    // the badge count (exact count of all project_messages rows) always equals
    // the number of rows the chat thread renders.
    const revIns = await clientA.from('project_messages').insert({
      project_id: projectAId,
      sender_id: clientAId,
      body: 'Please revise the EPC figures',
      type: 'revision_request',
    }).select('id');
    const badgeCount = await clientA
      .from('project_messages')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectAId);
    const threadRows = await fetchMessagesUntil(clientA, projectAId, 5);
    const threadHasRev = (threadRows.data ?? []).some((m) => m.type === 'revision_request');
    record(
      '7c) revision_request row is rendered in the thread (not excluded)',
      !revIns.error && !threadRows.error && threadHasRev,
      revIns.error?.message || threadRows.error?.message || `thread rows=${threadRows.data?.length ?? 0}`,
    );
    record(
      '7d) badge count == rendered thread rows (plain + revision requests)',
      !revIns.error &&
        !badgeCount.error &&
        !threadRows.error &&
        badgeCount.count === (threadRows.data ?? []).length &&
        (threadRows.data ?? []).length === 5,
      revIns.error?.message ||
        badgeCount.error?.message ||
        threadRows.error?.message ||
        `badge=${badgeCount.count} thread=${threadRows.data?.length ?? 0}`,
    );
  }

  // --- cleanup (ONLY this script's rows; demo project untouched) -------------
  console.log('\n--- cleanup ---');
  // Inserts above fire the notification triggers — clean up the rows they made.
  const { error: notifDelErr } = await admin
    .from('notifications')
    .delete()
    .in('link', [`/projects/${projectAId}`, `/projects/${projectBId}`]);
  const { data: leftoverNotif } = await admin
    .from('notifications')
    .select('id')
    .in('link', [`/projects/${projectAId}`, `/projects/${projectBId}`]);
  record(
    'cleanup: notification rows created by this script deleted',
    !notifDelErr && (leftoverNotif?.length ?? 0) === 0,
    notifDelErr ? notifDelErr.message : `remaining=${leftoverNotif?.length ?? 0}`,
  );

  const { error: msgDelErr } = await admin
    .from('project_messages')
    .delete()
    .in('project_id', [projectAId, projectBId]);
  const { data: leftoverMsg } = await admin
    .from('project_messages')
    .select('id')
    .in('project_id', [projectAId, projectBId]);
  record(
    'cleanup: script-created message rows deleted',
    !msgDelErr && (leftoverMsg?.length ?? 0) === 0,
    msgDelErr ? msgDelErr.message : `remaining=${leftoverMsg?.length ?? 0}`,
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