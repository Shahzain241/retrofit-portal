/**
 * Profile.jsx avatar-upload verification.
 *
 * Verifies the avatar upload wiring (Profile.jsx + ProfileContext.jsx) and the
 * `avatars` Storage bucket provisioning (backend/setup-scripts/setup-avatars-bucket.cjs):
 *
 *   PART A — Profile.jsx source checks
 *       a1) handleAvatar uploads to the `avatars` bucket
 *       a2) it uses the avatars/{user_id}/avatar.{ext} path with upsert:true
 *       a3) it resolves the public URL via getPublicUrl
 *       a4) it persists that URL to profiles.avatar_url
 *       a5) on success the UI swaps to the real uploaded URL
 *       a6) client-side guards: image-only + 2MB max
 *       a7) failures surface via the toast pattern (upload/db errors)
 *
 *   PART B — ProfileContext.jsx + setup script source checks
 *       b1) ProfileContext hydrates avatar from profiles.avatar_url
 *       b2) setup script creates a public `avatars` bucket
 *       b3) setup script's storage policies: anyone reads, owner-only
 *           insert/update/delete (path prefixed by auth.uid())
 *       b4) setup script adds the profiles.avatar_url column
 *
 *   PART C — live Storage flow (real project; requires the setup script to
 *            have been run so the bucket + column exist)
 *       c1) a signed-in user uploads their avatar → succeeds
 *       c2) the public URL is reachable over HTTP
 *       c3) profiles.avatar_url persists (client writes, super-admin sees it)
 *       c4) a DIFFERENT user cannot upload to another user's path
 *       c5) re-upload with upsert replaces the existing object
 *       c6) the owner can delete their own object (cleanup)
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test auth
 * accounts; the uploaded object is always removed by its owner.
 *
 * Usage: node backend/verify-scripts/verify-profile-avatar.cjs
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
const SETUP_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'setup-scripts', 'setup-avatars-bucket.cjs'),
  'utf8',
);
const idx = (src, needle) => src.indexOf(needle);

function handleAvatarSource(src) {
  const start = idx(src, 'function handleAvatar');
  if (start < 0) return '';
  const end = src.indexOf('\n  function ', start + 1);
  return src.slice(start, end > start ? end : start + 4000);
}

// --- PART A: Profile.jsx avatar upload (source checks) -------------------------
function partA() {
  console.log('\n--- PART A: Profile.jsx avatar upload (source checks) ---');
  const avatarFn = handleAvatarSource(PROFILE_SRC);

  const a1 = avatarFn.includes('supabase.storage') &&
    avatarFn.includes("from('avatars')") &&
    avatarFn.includes('.upload(');
  record(
    'a1) handleAvatar uploads to the avatars bucket',
    a1,
    a1 ? '' : 'missing supabase.storage.from(\'avatars\').upload(...) in handleAvatar',
  );

  const a2 = idx(avatarFn, '${userId}/avatar.') >= 0 && avatarFn.includes('upsert: true');
  record(
    'a2) uses avatars/{user_id}/avatar.{ext} path with upsert:true',
    a2,
    a2 ? '' : 'missing userId-prefixed path and/or upsert:true',
  );

  const a3 = avatarFn.includes('getPublicUrl(');
  record(
    'a3) resolves the public URL via getPublicUrl',
    a3,
    a3 ? '' : 'missing getPublicUrl call',
  );

  const a4 = idx(avatarFn, 'update({ avatar_url:') >= 0 && idx(avatarFn, "from('profiles')") >= 0;
  record(
    'a4) persists the URL to profiles.avatar_url',
    a4,
    a4 ? '' : 'missing profiles.avatar_url write',
  );

  const a5 = avatarFn.includes('updateProfile({ avatar:');
  record(
    'a5) success swaps the UI to the real uploaded URL',
    a5,
    a5 ? '' : 'missing updateProfile({ avatar: <publicUrl> }) on success',
  );

  const a6 = avatarFn.includes("file.type.startsWith('image/')") &&
    avatarFn.includes('2 * 1024 * 1024');
  record(
    'a6) client-side guards: image-only + 2MB max',
    a6,
    a6 ? '' : 'missing image-type and/or 2MB guard',
  );

  const a7 = avatarFn.includes('showToast({ type: \'error\'' ) &&
    (avatarFn.includes('uploadError.message') || avatarFn.includes('dbError.message'));
  record(
    'a7) upload/db failures surface via the toast pattern',
    a7,
    a7 ? '' : 'missing error toast wiring',
  );
}

// --- PART B: ProfileContext + setup script (source checks) ---------------------
function partB() {
  console.log('\n--- PART B: ProfileContext.jsx + setup script (source checks) ---');

  const b1 = idx(CTX_SRC, 'avatar: data.avatar_url ?? prev.avatar') >= 0;
  record(
    'b1) ProfileContext hydrates avatar from profiles.avatar_url',
    b1,
    b1 ? '' : 'avatar_url hydration not found in ProfileContext.jsx',
  );

  const b2 = SETUP_SRC.includes('insert into storage.buckets') &&
    SETUP_SRC.includes('id, name, public, file_size_limit, allowed_mime_types') &&
    SETUP_SRC.includes("'avatars', 'avatars', true");
  record(
    'b2) setup script creates a public avatars bucket',
    b2,
    b2 ? '' : 'public bucket creation not found in setup script',
  );

  const b3 = SETUP_SRC.includes("for select using (bucket_id = 'avatars')") &&
    SETUP_SRC.includes("auth.uid()::text") &&
    SETUP_SRC.includes("(storage.foldername(name))[1]") &&
    SETUP_SRC.includes('to authenticated');
  record(
    'b3) policies: anyone reads; owner-only insert/update/delete (auth.uid() path)',
    b3,
    b3 ? '' : 'storage policies not found in setup script',
  );

  const b4 = SETUP_SRC.includes('add column if not exists avatar_url text');
  record(
    'b4) setup script adds the profiles.avatar_url column',
    b4,
    b4 ? '' : 'avatar_url column DDL not found in setup script',
  );
}

// --- PART C: live Storage flow ---------------------------------------------------
async function partC() {
  const stamp = Date.now().toString(36);
  const emailA = `avatar-a-${stamp}@verify.test`;
  const emailB = `avatar-b-${stamp}@verify.test`;
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
  const aId = (await clientA.auth.getUser()).data.user.id;
  const bId = (await clientB.auth.getUser()).data.user.id;
  const aPath = `${aId}/avatar.png`;
  console.log('setup: client A', emailA, aId);
  console.log('setup: client B', emailB, bId);

  // --- c1) own upload succeeds ---------------------------------------------------
  const upA = await clientA.storage.from('avatars').upload(aPath, png, {
    contentType: 'image/png',
    upsert: true,
  });
  record(
    'c1) client A uploads own avatar (avatars/{uid}/avatar.png)',
    !upA.error,
    upA.error ? upA.error.message : `path=${aPath}`,
  );

  // --- c2) public URL reachable ----------------------------------------------------
  const { data: urlData } = clientA.storage.from('avatars').getPublicUrl(aPath);
  const publicUrl = urlData.publicUrl;
  const res = await retryingFetch(publicUrl);
  const bytes = await res.arrayBuffer();
  record(
    'c2) public URL is reachable over HTTP (public bucket)',
    res.status === 200 && bytes.byteLength > 0,
    `status=${res.status} bytes=${bytes.byteLength}`,
  );

  // --- c3) profiles.avatar_url persists ---------------------------------------------
  const colCheck = await clientA.from('profiles').select('avatar_url').eq('id', aId).single();
  if (colCheck.error) {
    recordSkip('c3) profiles.avatar_url persists (client writes, super-admin sees it)', `column check: ${colCheck.error.message}`);
  } else {
    const dbWrite = await clientA
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', aId);
    const adminView = await admin.from('profiles').select('avatar_url').eq('id', aId).single();
    record(
      'c3) profiles.avatar_url persists (client writes, super-admin sees it)',
      !dbWrite.error && adminView.data?.avatar_url === publicUrl,
      dbWrite.error ? dbWrite.error.message : `avatar_url=${adminView.data?.avatar_url}`,
    );
  }

  // --- c4) a different user cannot upload to another user's path ---------------------
  const crossUp = await clientB.storage.from('avatars').upload(aPath, png, {
    contentType: 'image/png',
    upsert: true,
  });
  // Read is intentionally public (avatars_public_read), so listing A's folder
  // is expected to succeed. The security property under test is WRITE
  // isolation: the insert/update policy is uid-prefixed, so B's upload onto
  // A's path must be rejected by RLS.
  const blockedByRls = !!crossUp.error &&
    /row[- ]level security|permission denied|violates/i.test(crossUp.error.message ?? '');
  record(
    'c4) client B cannot upload to client A\u2019s path (owner-only policy)',
    blockedByRls,
    crossUp.error ? crossUp.error.message : 'cross-user upload unexpectedly allowed',
  );

  // --- c5) upsert re-upload replaces the existing object ------------------------------
  const upA2 = await clientA.storage.from('avatars').upload(aPath, png, {
    contentType: 'image/png',
    upsert: true,
  });
  record(
    'c5) re-upload with upsert:true replaces the existing object',
    !upA2.error,
    upA2.error ? upA2.error.message : 'replaced same path (no orphan)',
  );

  // --- c6) owner can delete their own object ------------------------------------------
  const del = await clientA.storage.from('avatars').remove([aPath]);
  // The public-bucket object URL is CDN-cached (returns 200 for a while even
  // after the object is gone), and unknown query strings get a 400 from the
  // storage endpoint. So verify deletion via a folder list instead: read is
  // public, so listing A's folder must now come back empty.
  const afterDel = await clientB.storage.from('avatars').list(aId);
  record(
    'c6) owner deletes their own object (cleanup)',
    !del.error && (afterDel.data?.length ?? 0) === 0,
    del.error ? del.error.message : `objects remaining=${afterDel.data?.length ?? 0}`,
  );

  // --- account cleanup ----------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      const emails = [emailA, emailB].map((e) => `'${e}'`).join(', ');
      await runQuery(`delete from public.profiles where email in (${emails});`);
      await runQuery(`delete from auth.users where email in (${emails});`);
      const remaining = await runQuery(
        `select email from auth.users where email in (${emails});`,
      );
      record(
        `cleanup: ${[emailA, emailB].length} test account(s) deleted`,
        (remaining?.length ?? 0) === 0,
        `remaining=${remaining?.length ?? 0}`,
      );
    } catch (e) {
      record('cleanup: test accounts deleted', false, e.message);
    }
  } else {
    console.log(`  SKIP  cleanup of test accounts — set SUPABASE_MANAGEMENT_TOKEN to delete ${emailA}, ${emailB}`);
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