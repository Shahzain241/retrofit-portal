/**
 * Task & Docs "Upload Documents" verification.
 *
 * Confirms the TaskDocsTab.jsx "Upload Documents" button — previously local
 * state + toast only — now performs a real private-Storage upload + a real
 * `project_documents` INSERT, scoped to the owning client:
 *
 *   PART A — source checks (no browser harness)
 *       a1) documents are fetched from the `project_documents` table scoped
 *           to the current project (no placeholder/local-only list)
 *       a2) handleUpload uploads to the `project-documents` bucket then
 *           INSERTs a project_documents row (uploaded_by = auth.uid()),
 *           with the success toast only after the write succeeds
 *       a3) client-side type + size guard is present (allowed doc types, 10MB)
 *       a4) viewing uses a short-lived signed URL (createSignedUrl)
 *
 *   PART B — live checks
 *       b1) a client uploads a file + inserts a row (real upload+insert)
 *       b2) the row round-trips: correct project_id / uploaded_by / file_name /
 *           file_path / file_type
 *       b3) the object actually exists in the project-documents bucket at the
 *           recorded path (storage.objects)
 *       b4) the document persists across a refetch (same row returned)
 *       b5) the owning client can generate a signed URL (readable)
 *       b6) staff/admin can read via signed URL (super-admin read — same
 *           is_staff()/is_super_admin() predicate)
 *       b7) RLS blocks inserting a document row for another client's project
 *       b8) RLS blocks selecting another client's project documents
 *       b9) RLS blocks uploading a file into another client's project folder
 *
 * Requires scripts/sql/12_project_documents_table.sql (table + RLS) and
 * scripts/setup-project-documents-bucket.cjs (private bucket + storage RLS).
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is used for storage cleanup + auth-account cleanup.
 * Usage: node scripts/verify-taskdocs-upload.cjs
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
    TASKDOCS_SRC.includes("from('project_documents')") &&
    TASKDOCS_SRC.includes(".eq('project_id', projectId)") &&
    !TASKDOCS_SRC.includes('DOCUMENTS_PLACEHOLDER');
  record(
    'a1) documents fetched from project_documents scoped to the project (no placeholder)',
    a1,
    a1 ? '' : 'documents list is not fetched from the table or still uses a placeholder',
  );

  const a2 =
    TASKDOCS_SRC.includes("storage\n        .from(DOC_BUCKET)") &&
    TASKDOCS_SRC.includes('.upload(storagePath, file') &&
    TASKDOCS_SRC.includes("from('project_documents').insert({") &&
    TASKDOCS_SRC.includes('uploaded_by: user.id') &&
    /showToast\(\{ type: 'success', message: `Uploaded \$\{uploaded\.length\} document/.test(TASKDOCS_SRC);
  record(
    'a2) upload to bucket + real project_documents insert, toast after success',
    a2,
    a2 ? '' : 'missing bucket upload / table insert / toast-after-success wiring',
  );

  const a3 =
    TASKDOCS_SRC.includes('ALLOWED_DOC_TYPES') &&
    TASKDOCS_SRC.includes('MAX_DOC_SIZE') &&
    TASKDOCS_SRC.includes('10MB or smaller');
  record(
    'a3) client-side type + size guard present (doc types, 10MB)',
    a3,
    a3 ? '' : 'client-side file guard missing',
  );

  const a4 =
    TASKDOCS_SRC.includes("createSignedUrl(doc.filePath, 60)");
  record(
    'a4) viewing via short-lived signed URL (createSignedUrl)',
    a4,
    a4 ? '' : 'signed-URL viewing missing',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectId = `DOCPRJ-${stamp}`;
  const clientAEmail = `docup-a-${stamp}@verify.test`;
  const clientBEmail = `docup-b-${stamp}@verify.test`;
  const createdEmails = [clientAEmail, clientBEmail];
  const fileName = 'survey-report.pdf';
  const fileType = 'application/pdf';
  const storagePath = `${projectId}/${Date.now().toString(36)}-survey-report.pdf`;
  const fakePdf = Buffer.from('%PDF-1.4\nfake retrofit survey report\n%%EOF');

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

  // Seed a project owned by client A.
  const { error: seedErr } = await admin.from('projects').insert({
    id: projectId,
    name: 'Docs Seed',
    status: 'active',
    progress: 0,
    address_line1: '1 Docs St',
    address_city: 'London',
    address_postcode: 'SW1A 1AA',
    service: 'HVAC Retrofit',
    client_id: clientAId,
  });
  record('seed: test project created for client A', !seedErr, seedErr ? seedErr.message : projectId);
  const seedingOk = !seedErr;
  if (!seedingOk) {
    recordSkip('b1) real upload + insert', 'seeding failed');
  }

  // --- b1) real upload + insert (exact TaskDocsTab path) ----------------------
  const upload = await clientA.storage
    .from('project-documents')
    .upload(storagePath, fakePdf, { contentType: fileType });
  const {
    data: { user: aUser },
  } = await clientA.auth.getUser();
  const insert = await clientA.from('project_documents').insert({
    project_id: projectId,
    uploaded_by: aUser.id,
    file_name: fileName,
    file_path: storagePath,
    file_type: fileType,
  });
  record(
    'b1) client A uploads file + inserts row (real upload+insert)',
    !upload.error && !insert.error,
    upload.error?.message || insert.error?.message || storagePath,
  );

  // --- b2) row round-trips with correct scoping ---------------------------------
  const { data: rows, error: rowsErr } = await admin
    .from('project_documents')
    .select('*')
    .eq('project_id', projectId);
  const mine = (rows ?? []).find((r) => r.file_path === storagePath);
  const b2 =
    !insert.error &&
    !rowsErr &&
    !!mine &&
    mine.project_id === projectId &&
    mine.uploaded_by === clientAId &&
    mine.file_name === fileName &&
    mine.file_path === storagePath &&
    mine.file_type === fileType;
  record(
    'b2) row scoped to project_id/uploaded_by + file_name/path/type',
    b2,
    rowsErr ? rowsErr.message : `uploaded_by=${mine?.uploaded_by} path=${mine?.file_path}`,
  );

  // --- b3) object exists in the bucket at the recorded path ----------------------
  const storageRows = await runQuery(
    `select bucket_id, name from storage.objects where bucket_id = 'project-documents' and name = '${storagePath.replace(/'/g, "''")}';`,
  );
  record(
    'b3) object exists in project-documents bucket at recorded path',
    Array.isArray(storageRows) && storageRows.length === 1,
    `rows=${Array.isArray(storageRows) ? storageRows.length : 'n/a'}`,
  );

  // --- b4) persists across a refetch --------------------------------------------
  const firstFetch = await clientA
    .from('project_documents')
    .select('*')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: true });
  const secondFetch = await clientA
    .from('project_documents')
    .select('*')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: true });
  const firstIds = (firstFetch.data ?? []).map((r) => r.id);
  const secondIds = (secondFetch.data ?? []).map((r) => r.id);
  const persistedRow = (secondFetch.data ?? []).find((r) => r.file_path === storagePath);
  record(
    'b4) document persists across a refetch (same row returned)',
    !firstFetch.error &&
      !secondFetch.error &&
      firstIds.length === secondIds.length &&
      !!persistedRow &&
      persistedRow.uploaded_by === clientAId,
    firstFetch.error?.message ||
      secondFetch.error?.message ||
      `ids=[${firstIds.join(',')}] then [${secondIds.join(',')}]`,
  );

  // --- b5) owning client can generate a signed URL --------------------------------
  const clientSigned = await clientA.storage
    .from('project-documents')
    .createSignedUrl(storagePath, 60);
  record(
    'b5) owning client can generate a signed URL (readable)',
    !clientSigned.error && !!clientSigned.data?.signedUrl,
    clientSigned.error ? clientSigned.error.message : 'signed URL returned',
  );

  // --- b6) staff/admin can read via signed URL -------------------------------------
  const adminSigned = await admin.storage
    .from('project-documents')
    .createSignedUrl(storagePath, 60);
  record(
    'b6) staff/admin can read via signed URL (super-admin read path)',
    !adminSigned.error && !!adminSigned.data?.signedUrl,
    adminSigned.error ? adminSigned.error.message : 'signed URL returned',
  );

  // --- b7) RLS: insert a row for another client's project rejected -----------------
  const spoofInsert = await clientB.from('project_documents').insert({
    project_id: projectId,
    uploaded_by: clientBId,
    file_name: 'spoof.pdf',
    file_path: `${projectId}/spoof.pdf`,
    file_type: 'application/pdf',
  });
  record(
    'b7) RLS rejects inserting a document row for another client\'s project',
    !!spoofInsert.error,
    spoofInsert.error ? spoofInsert.error.message : 'spoofed insert unexpectedly succeeded',
  );

  // --- b8) RLS: selecting another client's project documents returns 0 -------------
  const crossSelect = await clientB
    .from('project_documents')
    .select('*')
    .eq('project_id', projectId);
  record(
    'b8) RLS blocks selecting another client\'s project documents (0 rows)',
    !crossSelect.error && (crossSelect.data?.length ?? 0) === 0,
    crossSelect.error ? crossSelect.error.message : `rows=${crossSelect.data?.length ?? 0}`,
  );

  // --- b9) RLS: upload into another client's project folder rejected ---------------
  const spoofUpload = await clientB.storage
    .from('project-documents')
    .upload(`${projectId}/spoof-upload.pdf`, Buffer.from('%PDF-1.4'), { contentType: 'application/pdf' });
  record(
    'b9) RLS rejects uploading a file into another client\'s project folder',
    !!spoofUpload.error,
    spoofUpload.error ? spoofUpload.error.message : 'spoofed storage upload unexpectedly succeeded',
  );

  // --- cleanup ----------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: rowCleanup } = await admin
    .from('project_documents')
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
    'cleanup: project_documents rows + project deleted',
    !rowCleanup && !projCleanup && (leftover?.length ?? 0) === 0,
    rowCleanup?.message || projCleanup?.message || `remaining=${leftover?.length ?? 0}`,
  );

  if (MGMT_TOKEN) {
    try {
      // Storage API (super-admin now allowed by the delete policy) — direct
      // SQL DELETE on storage.objects is blocked by storage.protect_delete().
      const { error: objCleanup } = await admin.storage
        .from('project-documents')
        .remove([storagePath]);
      const remainingObjs = await runQuery(
        `select name from storage.objects where bucket_id = 'project-documents' and name = '${storagePath.replace(/'/g, "''")}';`,
      );
      record(
        'cleanup: uploaded storage object deleted',
        !objCleanup && (remainingObjs?.length ?? 0) === 0,
        objCleanup?.message || `remaining=${remainingObjs?.length ?? 0}`,
      );
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
      record('cleanup: storage object + auth accounts deleted', false, e.message);
    }
  } else {
    recordSkip('cleanup: storage object + auth accounts deleted', `set SUPABASE_MANAGEMENT_TOKEN to delete test data`);
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