/**
 * Task & Docs "Send Request" (revision request) verification.
 *
 * Confirms the TaskDocsTab.jsx "Send Request" button — previously a toast +
 * local-feedback-only mock — now performs a real, RLS-scoped INSERT into
 * `project_messages` (type='revision_request') and that the request is then
 * readable through the same query the Communication tab thread uses:
 *
 *   PART A — source checks (no browser harness)
 *       a1) submitRevision does a real
 *           supabase.from('project_messages').insert({...}) with
 *           project_id, sender_id = auth.uid() (from getUser()), and
 *           type = 'revision_request'
 *       a2) success toast is only shown after a successful insert (not a
 *           toast-only fake)
 *
 *   PART B — live checks
 *       b1) a client-role user can INSERT a revision request for their own
 *           project (real row, not a toast)
 *       b2) the new row round-trips with sender_id = auth.uid(), the right
 *           project_id, the request body and type='revision_request'
 *       b3) the request is visible via the Communication tab's exact fetch
 *           (.select('*').eq('project_id', id).order('created_at', asc))
 *       b4) RLS: another client cannot insert a revision request for someone
 *           else's project (spoofed project_id)
 *       b5) RLS: a client cannot insert with a spoofed sender_id
 *       b6) RLS: a client cannot insert a request for a project they don't own
 *
 * Requires the `type` column on project_messages (scripts/sql/
 * 10_project_messages_type_column.sql) and the existing project_messages RLS
 * policies (clients_insert_own_project_messages etc.).
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test
 * auth account. Usage: node scripts/verify-taskdocs-send-request.cjs
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
const TASKDOCS_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'client', 'project-tabs', 'TaskDocsTab.jsx'),
  'utf8',
);

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    TASKDOCS_SRC.includes("from('project_messages')") &&
    TASKDOCS_SRC.includes('.insert({') &&
    TASKDOCS_SRC.includes('project_id: projectId') &&
    TASKDOCS_SRC.includes('sender_id: user.id') &&
    TASKDOCS_SRC.includes("type: 'revision_request'") &&
    TASKDOCS_SRC.includes('supabase.auth.getUser()');
  record(
    'a1) submitRevision does a real project_messages insert (type=revision_request, sender=auth.uid())',
    a1,
    a1 ? '' : 'submitRevision is missing the real insert/scope fields',
  );

  const a2 =
    TASKDOCS_SRC.includes('if (error) {') &&
    /showToast\(\{ type: 'success', message: 'Revision request sent' \}\)/.test(TASKDOCS_SRC) &&
    TASKDOCS_SRC.includes("showToast({ type: 'error', message: error.message || 'Could not send the revision request.' })");
  record(
    'a2) success toast only after successful insert (not toast-only)',
    a2,
    a2 ? '' : 'success toast not gated on a successful insert',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectId = `REVPRJ-${stamp}`;
  const clientAEmail = `revreq-a-${stamp}@verify.test`;
  const clientBEmail = `revreq-b-${stamp}@verify.test`;
  const createdEmails = [clientAEmail, clientBEmail];
  const requestBody = 'Please update the EPC figures in the survey.';

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

  // Seed a project owned by client A (super-admin INSERT).
  const { error: seedErr } = await admin.from('projects').insert({
    id: projectId,
    name: 'Revision Seed',
    status: 'active',
    progress: 0,
    address_line1: '1 Revision St',
    address_city: 'London',
    address_postcode: 'SW1A 1AA',
    service: 'HVAC Retrofit',
    client_id: clientAId,
  });
  record('seed: test project created for client A', !seedErr, seedErr ? seedErr.message : projectId);
  const seedingOk = !seedErr;
  if (!seedingOk) {
    recordSkip('b1) client A can insert a revision request', 'seeding failed');
  }

  // --- b1) real insert (exact TaskDocsTab path) -------------------------------
  const {
    data: { user: aUser },
  } = await clientA.auth.getUser();
  const insert = await clientA.from('project_messages').insert({
    project_id: projectId,
    sender_id: aUser.id,
    body: requestBody,
    type: 'revision_request',
  });
  record(
    'b1) client INSERT of revision_request succeeds (real row)',
    !insert.error,
    insert.error ? insert.error.message : 'inserted',
  );

  // --- b2) row round-trips with correct scoping --------------------------------
  const { data: rows, error: rowsErr } = await admin
    .from('project_messages')
    .select('*')
    .eq('project_id', projectId);
  const mine = (rows ?? []).find((r) => r.type === 'revision_request');
  const b2 =
    !insert.error &&
    !rowsErr &&
    !!mine &&
    mine.sender_id === clientAId &&
    mine.project_id === projectId &&
    mine.body === requestBody &&
    mine.type === 'revision_request';
  record(
    'b2) row scoped to sender=auth.uid(), project, body + type=revision_request',
    b2,
    rowsErr ? rowsErr.message : `sender=${mine?.sender_id} type=${mine?.type}`,
  );

  // --- b3) visible via the Communication tab fetch ------------------------------
  const threadFetch = await clientA
    .from('project_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  const thread = (threadFetch.data ?? []).map((m) => m.type);
  record(
    'b3) revision request visible via Communication tab thread fetch',
    !threadFetch.error && (threadFetch.data ?? []).some((m) => m.type === 'revision_request' && m.sender_id === clientAId),
    threadFetch.error ? threadFetch.error.message : `types=${thread.join(', ')}`,
  );

  // --- b4) RLS: spoofed project (someone else's project) rejected --------------
  const spoofProject = await clientB.from('project_messages').insert({
    project_id: projectId,
    sender_id: clientBId,
    body: 'spoof',
    type: 'revision_request',
  });
  record(
    'b4) RLS rejects inserting a request for another client\'s project',
    !!spoofProject.error,
    spoofProject.error ? spoofProject.error.message : 'spoofed project insert unexpectedly succeeded',
  );

  // --- b5) RLS: spoofed sender_id rejected --------------------------------------
  const spoofSender = await clientA.from('project_messages').insert({
    project_id: projectId,
    sender_id: clientBId,
    body: 'spoof sender',
    type: 'revision_request',
  });
  record(
    'b5) RLS rejects inserting with a spoofed sender_id',
    !!spoofSender.error,
    spoofSender.error ? spoofSender.error.message : 'spoofed sender insert unexpectedly succeeded',
  );

  // --- b6) RLS: nonexistent/unowned project rejected ----------------------------
  const unowned = await clientA.from('project_messages').insert({
    project_id: `NOT-OWNED-${stamp}`,
    sender_id: clientAId,
    body: 'spoof project',
    type: 'revision_request',
  });
  record(
    'b6) RLS rejects inserting a request for an unowned/nonexistent project',
    !!unowned.error,
    unowned.error ? unowned.error.message : 'unowned-project insert unexpectedly succeeded',
  );

  // --- cleanup --------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: msgCleanup } = await admin
    .from('project_messages')
    .delete()
    .eq('project_id', projectId);
  const { error: projCleanup } = await admin
    .from('projects')
    .delete()
    .eq('id', projectId);
  const { data: leftover } = await admin
    .from('projects')
    .select('id')
    .eq('id', projectId);
  record(
    'cleanup: test messages + project deleted',
    !msgCleanup && !projCleanup && (leftover?.length ?? 0) === 0,
    msgCleanup?.message || projCleanup?.message || `remaining=${leftover?.length ?? 0}`,
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