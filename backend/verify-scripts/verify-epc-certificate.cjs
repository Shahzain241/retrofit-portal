/**
 * Profile.jsx EPC-certificate upload verification.
 *
 * Verifies the EPC certificate upload wiring (Profile.jsx + ProfileContext.jsx)
 * and the `epc-certificates` Storage bucket provisioning
 * (backend/setup-scripts/setup-epc-bucket.cjs):
 *
 *   PART A — Profile.jsx source checks
 *       a1) handleEpcUpload uploads to the `epc-certificates` bucket
 *       a2) it uses the {user_id}/certificate.{ext} path with upsert:true
 *       a3) it does NOT use getPublicUrl (private bucket) — a fresh signed URL
 *           is generated on demand via createSignedUrl
 *       a4) it persists the storage PATH (not a URL) to profiles.epc_certificate_path
 *       a5) the View handler creates a short-lived (60s) signed URL on click
 *       a6) client-side guards: PDF/JPG/PNG only + 5MB max
 *       a7) failures surface via the toast pattern (upload/db errors)
 *
 *   PART B — ProfileContext.jsx + setup script source checks
 *       b1) ProfileContext hydrates the path from profiles.epc_certificate_path
 *       b2) setup script creates a PRIVATE `epc-certificates` bucket (5MB,
 *           PDF/JPG/PNG only)
 *       b3) read policy: owner OR staff (is_staff()) OR super-admin
 *           (is_super_admin()) — NOT public
 *       b4) write policies owner-only (path prefixed by auth.uid())
 *       b5) setup script adds the profiles.epc_certificate_path column
 *
 *   PART C — live Storage flow (real project; requires the setup script to
 *            have been run so the bucket + column exist)
 *       c1) the owning client uploads their certificate → succeeds
 *       c2) the raw object URL is NOT publicly reachable (private bucket)
 *       c3) the owner can generate a signed URL and download via it
 *       c4) a different NON-staff client cannot read the object (signed URL
 *           rejected) nor list the owner's folder
 *       c5) a different NON-staff client cannot upload to the owner's path
 *       c6) a staff (coordinator) user CAN read via a signed URL
 *       c7) profiles.epc_certificate_path persists (client writes, super-admin
 *           sees it)
 *       c8) re-upload with upsert replaces the existing object
 *       c9) the owner can delete their own object (cleanup)
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test auth
 * accounts; the uploaded object is always removed by its owner.
 *
 * Usage: node backend/verify-scripts/verify-epc-certificate.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
const PROFILE_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'pages', 'client', 'Profile.jsx'),
  'utf8',
);
const CTX_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'context', 'ProfileContext.jsx'),
  'utf8',
);
const SETUP_SRC = fs.readFileSync(path.join(__dirname, '..', 'setup-scripts', 'setup-epc-bucket.cjs'), 'utf8');
const idx = (src, needle) => src.indexOf(needle);

// The EPC region covers both handleEpcUpload and handleViewEpc.
function epcRegion(src) {
  const start = idx(src, 'function handleEpcUpload');
  if (start < 0) return '';
  const end = src.indexOf('\n  const set =', start + 1);
  return src.slice(start, end > start ? end : start + 5000);
}

// --- PART A: Profile.jsx EPC upload (source checks) ---------------------------
function partA() {
  console.log('\n--- PART A: Profile.jsx EPC upload (source checks) ---');
  const epcFn = epcRegion(PROFILE_SRC);

  const a1 = epcFn.includes('supabase.storage') &&
    epcFn.includes("from('epc-certificates')") &&
    epcFn.includes('.upload(');
  record(
    'a1) handleEpcUpload uploads to the epc-certificates bucket',
    a1,
    a1 ? '' : 'missing supabase.storage.from(\'epc-certificates\').upload(...) in handleEpcUpload',
  );

  const a2 = idx(epcFn, '${userId}/certificate.') >= 0 && epcFn.includes('upsert: true');
  record(
    'a2) uses {user_id}/certificate.{ext} path with upsert:true',
    a2,
    a2 ? '' : 'missing userId-prefixed certificate path and/or upsert:true',
  );

  const a3 = !epcFn.includes('getPublicUrl') && epcFn.includes('createSignedUrl(');
  record(
    'a3) private bucket — no getPublicUrl, signed URLs via createSignedUrl',
    a3,
    a3 ? '' : 'EPC region must use createSignedUrl and NOT getPublicUrl',
  );

  const a4 = idx(epcFn, 'update({ epc_certificate_path:') >= 0 && idx(epcFn, "from('profiles')") >= 0;
  record(
    'a4) persists the storage PATH to profiles.epc_certificate_path',
    a4,
    a4 ? '' : 'missing profiles.epc_certificate_path write',
  );

  const a5 = epcFn.includes('createSignedUrl(epcPath, 60)');
  record(
    'a5) View handler creates a fresh 60s signed URL on click',
    a5,
    a5 ? '' : 'missing createSignedUrl(epcPath, 60) in View handler',
  );

  const a6 = epcFn.includes("'application/pdf'") &&
    epcFn.includes("'image/jpeg'") &&
    epcFn.includes("'image/png'") &&
    epcFn.includes('5 * 1024 * 1024');
  record(
    'a6) client-side guards: PDF/JPG/PNG only + 5MB max',
    a6,
    a6 ? '' : 'missing PDF/JPG/PNG and/or 5MB guard',
  );

  const a7 = epcFn.includes('showToast({ type: \'error\'' ) &&
    (epcFn.includes('uploadError.message') || epcFn.includes('dbError.message'));
  record(
    'a7) upload/db failures surface via the toast pattern',
    a7,
    a7 ? '' : 'missing error toast wiring',
  );
}

// --- PART B: ProfileContext + setup script (source checks) ---------------------
function partB() {
  console.log('\n--- PART B: ProfileContext.jsx + setup script (source checks) ---');

  const b1 = idx(CTX_SRC, 'epcCertificatePath: data.epc_certificate_path ?? prev.epcCertificatePath') >= 0;
  record(
    'b1) ProfileContext hydrates path from profiles.epc_certificate_path',
    b1,
    b1 ? '' : 'epc_certificate_path hydration not found in ProfileContext.jsx',
  );

  const b2 = SETUP_SRC.includes('insert into storage.buckets') &&
    SETUP_SRC.includes('id, name, public, file_size_limit, allowed_mime_types') &&
    SETUP_SRC.includes("'epc-certificates', 'epc-certificates', false") &&
    SETUP_SRC.includes('5242880');
  record(
    'b2) setup script creates a PRIVATE epc-certificates bucket (5MB, PDF/JPG/PNG)',
    b2,
    b2 ? '' : 'private bucket creation not found in setup script',
  );

  const b3 = SETUP_SRC.includes('epc_certificates_read') &&
    SETUP_SRC.includes('public.is_staff()') &&
    SETUP_SRC.includes('public.is_super_admin()') &&
    SETUP_SRC.includes('for select to authenticated');
  record(
    'b3) read policy: owner OR staff OR super-admin (not public)',
    b3,
    b3 ? '' : 'owner/staff/super-admin read policy not found in setup script',
  );

  const b4 = SETUP_SRC.includes('auth.uid()::text') &&
    SETUP_SRC.includes('(storage.foldername(name))[1]') &&
    SETUP_SRC.includes('to authenticated') &&
    SETUP_SRC.includes('epc_certificates_own_insert');
  record(
    'b4) write policies: owner-only insert/update/delete (auth.uid() path)',
    b4,
    b4 ? '' : 'owner-only write policies not found in setup script',
  );

  const b5 = SETUP_SRC.includes('add column if not exists epc_certificate_path text');
  record(
    'b5) setup script adds the profiles.epc_certificate_path column',
    b5,
    b5 ? '' : 'epc_certificate_path column DDL not found in setup script',
  );
}

// --- PART C: live Storage flow ---------------------------------------------------
async function partC() {
  const stamp = Date.now().toString(36);
  const emailA = `epc-a-${stamp}@verify.test`;
  const emailB = `epc-b-${stamp}@verify.test`;
  const emailStaff = `epc-staff-${stamp}@verify.test`;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

  console.log('\n--- PART C: live Storage flow ---');

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
    if (error || !data?.user?.id) throw new Error(`signup ${email}: ${error?.message}`);
    if (adminSession) {
      await admin.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
    }
    return c;
  }
  const clientA = await makeClient(emailA);
  const clientB = await makeClient(emailB);
  const clientStaff = await makeClient(emailStaff);
  const aId = (await clientA.auth.getUser()).data.user.id;
  const bId = (await clientB.auth.getUser()).data.user.id;
  const staffId = (await clientStaff.auth.getUser()).data.user.id;
  const aPath = `${aId}/certificate.png`;
  console.log('setup: client A (owner)', emailA, aId);
  console.log('setup: client B (non-staff)', emailB, bId);
  console.log('setup: staff (coordinator)', emailStaff, staffId);

  // --- staff role assignment (super-admin writes profiles.role) ----------------
  const { error: roleErr } = await admin
    .from('profiles')
    .update({ role: 'coordinator' })
    .eq('id', staffId);
  if (roleErr) throw new Error(`staff role assignment: ${roleErr.message}`);
  const { data: staffProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', staffId)
    .single();
  if (staffProfile?.role !== 'coordinator') {
    throw new Error(`staff role unexpected: ${staffProfile?.role}`);
  }
  console.log('setup: staff role = coordinator');

  // --- c1) owner upload succeeds -------------------------------------------------
  const upA = await clientA.storage.from('epc-certificates').upload(aPath, png, {
    contentType: 'image/png',
    upsert: true,
  });
  record(
    'c1) owner uploads own certificate (epc-certificates/{uid}/certificate.png)',
    !upA.error,
    upA.error ? upA.error.message : `path=${aPath}`,
  );

  // --- c2) raw object URL is NOT public (private bucket) -------------------------
  const rawRes = await retryingFetch(`${URL}/storage/v1/object/epc-certificates/${aPath}`);
  record(
    'c2) raw object URL not publicly reachable (private bucket)',
    rawRes.status === 404 || rawRes.status === 400 || rawRes.status === 403,
    `status=${rawRes.status}`,
  );

  // --- c3) owner can generate a signed URL and download via it --------------------
  const signA = await clientA.storage.from('epc-certificates').createSignedUrl(aPath, 60);
  let ownerDownloadOk = false;
  if (!signA.error && signA.data?.signedUrl) {
    const dl = await retryingFetch(signA.data.signedUrl);
    const bytes = await dl.arrayBuffer();
    ownerDownloadOk = dl.status === 200 && bytes.byteLength > 0;
  }
  record(
    'c3) owner generates a signed URL and downloads via it',
    !signA.error && ownerDownloadOk,
    signA.error ? signA.error.message : `signedUrl ok=${ownerDownloadOk}`,
  );

  // --- c4) non-staff client cannot read the object ----------------------------------
  const signB = await clientB.storage.from('epc-certificates').createSignedUrl(aPath, 60);
  let bDownloadBlocked = false;
  if (!signB.error && signB.data?.signedUrl) {
    const dl = await retryingFetch(signB.data.signedUrl);
    bDownloadBlocked = dl.status !== 200;
  } else {
    bDownloadBlocked = true; // signing itself rejected by RLS
  }
  const listB = await clientB.storage.from('epc-certificates').list(aId);
  record(
    'c4) non-staff client cannot read owner\u2019s certificate',
    bDownloadBlocked && (listB.data?.length ?? 0) === 0,
    signB.error ? signB.error.message : `bDownloadBlocked=${bDownloadBlocked} list=${listB.data?.length ?? 0}`,
  );

  // --- c5) non-staff client cannot upload to owner's path ---------------------------
  const crossUp = await clientB.storage.from('epc-certificates').upload(aPath, png, {
    contentType: 'image/png',
    upsert: true,
  });
  record(
    'c5) non-staff client cannot upload to owner\u2019s path',
    !!crossUp.error,
    crossUp.error ? crossUp.error.message : 'cross-user upload unexpectedly allowed',
  );

  // --- c6) staff CAN read via a signed URL ------------------------------------------
  const signStaff = await clientStaff.storage.from('epc-certificates').createSignedUrl(aPath, 60);
  let staffDownloadOk = false;
  if (!signStaff.error && signStaff.data?.signedUrl) {
    const dl = await retryingFetch(signStaff.data.signedUrl);
    const bytes = await dl.arrayBuffer();
    staffDownloadOk = dl.status === 200 && bytes.byteLength > 0;
  }
  record(
    'c6) staff (coordinator) can read via a signed URL',
    !signStaff.error && staffDownloadOk,
    signStaff.error ? signStaff.error.message : `signedUrl ok=${staffDownloadOk}`,
  );

  // --- c7) profiles.epc_certificate_path persists ------------------------------------
  const colCheck = await clientA.from('profiles').select('epc_certificate_path').eq('id', aId).single();
  if (colCheck.error) {
    recordSkip('c7) profiles.epc_certificate_path persists (client writes, super-admin sees it)', `column check: ${colCheck.error.message}`);
  } else {
    const dbWrite = await clientA
      .from('profiles')
      .update({ epc_certificate_path: aPath })
      .eq('id', aId);
    const adminView = await admin.from('profiles').select('epc_certificate_path').eq('id', aId).single();
    record(
      'c7) profiles.epc_certificate_path persists (client writes, super-admin sees it)',
      !dbWrite.error && adminView.data?.epc_certificate_path === aPath,
      dbWrite.error ? dbWrite.error.message : `epc_certificate_path=${adminView.data?.epc_certificate_path}`,
    );
  }

  // --- c8) upsert re-upload replaces the existing object -------------------------------
  const upA2 = await clientA.storage.from('epc-certificates').upload(aPath, png, {
    contentType: 'image/png',
    upsert: true,
  });
  record(
    'c8) re-upload with upsert:true replaces the existing object',
    !upA2.error,
    upA2.error ? upA2.error.message : 'replaced same path (no orphan)',
  );

  // --- c9) owner deletes their own object ----------------------------------------------
  const del = await clientA.storage.from('epc-certificates').remove([aPath]);
  const afterDel = await clientA.storage.from('epc-certificates').list(aId);
  record(
    'c9) owner deletes their own object (cleanup)',
    !del.error && (afterDel.data?.length ?? 0) === 0,
    del.error ? del.error.message : `objects remaining=${afterDel.data?.length ?? 0}`,
  );

  // --- account cleanup ----------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      const emails = [emailA, emailB, emailStaff].map((e) => `'${e}'`).join(', ');
      await runQuery(`delete from public.profiles where email in (${emails});`);
      await runQuery(`delete from auth.users where email in (${emails});`);
      const remaining = await runQuery(
        `select email from auth.users where email in (${emails});`,
      );
      record(
        `cleanup: ${[emailA, emailB, emailStaff].length} test account(s) deleted`,
        (remaining?.length ?? 0) === 0,
        `remaining=${remaining?.length ?? 0}`,
      );
    } catch (e) {
      record('cleanup: test accounts deleted', false, e.message);
    }
  } else {
    console.log(`  SKIP  cleanup of test accounts — set SUPABASE_MANAGEMENT_TOKEN to delete ${emailA}, ${emailB}, ${emailStaff}`);
  }
}

async function main() {
  partA();
  partB();
  await partC();

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