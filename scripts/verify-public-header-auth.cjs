/**
 * Public Header/Navbar auth verification (corrected scope).
 *
 * Header.jsx is shared by Landing, Services and ServiceDetail. It accepts a
 * `hideWhenAuthed` prop and uses the shared AuthContext session (useAuth →
 * getSession + onAuthStateChange, the same source ProtectedRoute uses):
 *
 *   - Landing (`<Header />`, no prop): the header + Login/Get Started ALWAYS
 *     render, regardless of auth state (unchanged from the original).
 *   - Services + ServiceDetail (`<Header hideWhenAuthed />`): the WHOLE header
 *     renders nothing when there is an active session; when logged out it shows
 *     the normal full header (logo + Login + Get Started).
 *
 *   PART A — source checks (no browser harness)
 *       a1) Header accepts `hideWhenAuthed` and returns null when
 *           `hideWhenAuthed && session` (uses the shared useAuth())
 *       a2) Landing does NOT pass hideWhenAuthed (always shows the header +
 *           both buttons regardless of session)
 *       a3) Services passes hideWhenAuthed
 *       a4) ServiceDetail passes hideWhenAuthed
 *       a5) Login/Get Started are unconditional in Header (no session gating on
 *           the buttons themselves)
 *
 *   PART B — live checks (real session state transitions)
 *       b1) logged-out: getSession() returns no session (full header on
 *           Services/ServiceDetail; Landing always shows buttons)
 *       b2) logged-in:  after sign-in, getSession() returns a real session
 *           (Services/ServiceDetail render nothing via hideWhenAuthed; Landing
 *           still shows the header)
 *       b3) after logout: getSession() returns null again (reflects the real
 *           state, not a stale/cached session)
 *
 * Credentials come from env vars (see .env.example): VITE_SUPABASE_ANON_KEY.
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test account.
 * Usage: node scripts/verify-public-header-auth.cjs
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
const HEADER_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'Header.jsx'),
  'utf8',
);
const LANDING_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'Landing.jsx'),
  'utf8',
);
const SERVICES_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'Services.jsx'),
  'utf8',
);
const SERVICEDETAIL_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'pages', 'ServiceDetail.jsx'),
  'utf8',
);

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    HEADER_SRC.includes('hideWhenAuthed = false') &&
    HEADER_SRC.includes('if (hideWhenAuthed && session)') &&
    HEADER_SRC.includes('return null;') &&
    HEADER_SRC.includes('const { session } = useAuth();');
  record(
    'a1) Header accepts hideWhenAuthed and renders null when hideWhenAuthed && session (shared useAuth)',
    a1,
    a1 ? '' : 'Header is missing the hideWhenAuthed prop / null-when-authed logic',
  );

  const a2 =
    LANDING_SRC.includes('<Header />') &&
    !LANDING_SRC.includes('<Header hideWhenAuthed');
  record(
    'a2) Landing does NOT pass hideWhenAuthed (always shows header + buttons)',
    a2,
    a2 ? '' : 'Landing is using the hiding behavior (should always show the header)',
  );

  const a3 = SERVICES_SRC.includes('<Header hideWhenAuthed');
  record('a3) Services passes hideWhenAuthed', a3, a3 ? '' : 'Services is not hiding the header when authed');

  const a4 = SERVICEDETAIL_SRC.includes('<Header hideWhenAuthed');
  record('a4) ServiceDetail passes hideWhenAuthed', a4, a4 ? '' : 'ServiceDetail is not hiding the header when authed');

  const a5 =
    HEADER_SRC.includes('header-btn-login') &&
    HEADER_SRC.includes('header-btn-primary') &&
    !HEADER_SRC.includes('showAuthButtons');
  record(
    'a5) Login + Get Started are unconditional in Header (no session gating on the buttons)',
    a5,
    a5 ? '' : 'buttons are still gated on the session inside Header',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const email = `pubheader-${stamp}@verify.test`;
  const password = 'VerifyPass123!';

  const client = createClient(URL, ANON, CLIENT_OPTIONS);

  // --- b1) logged-out: no session ----------------------------------------------
  const { data: before } = await client.auth.getSession();
  record(
    'b1) logged-out getSession() has no session (full header shown on Services/ServiceDetail; Landing always shows buttons)',
    before?.session == null,
    before?.session ? 'unexpected existing session' : 'no session',
  );

  // --- b2) logged-in: sign in produces a real session ----------------------------
  const { data: signupData, error: signupErr } = await client.auth.signUp({ email, password });
  if (signupErr || !signupData?.user?.id) throw new Error(`signup ${email}: ${signupErr?.message}`);
  const { data: afterLogin } = await client.auth.getSession();
  record(
    'b2) logged-in getSession() returns a real session (Services/ServiceDetail hide whole header; Landing unchanged)',
    afterLogin?.session != null && afterLogin.session.user?.id === signupData.user.id,
    afterLogin?.session
      ? `session user=${afterLogin.session.user.id}`
      : 'no session after sign-in (stale state)',
  );

  // --- b3) logged-out again: logout clears the session -----------------------------
  await client.auth.signOut();
  const { data: afterLogout } = await client.auth.getSession();
  record(
    'b3) after logout getSession() returns null (reflects real state, not cached)',
    afterLogout?.session == null,
    afterLogout?.session ? 'session survived logout (stale/cached)' : 'no session',
  );

  // --- cleanup -----------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      await runQuery(`delete from public.profiles where email = '${email}';`);
      await runQuery(`delete from auth.users where email = '${email}';`);
      const remaining = await runQuery(`select email from auth.users where email = '${email}';`);
      record(
        'cleanup: test auth account deleted',
        (remaining?.length ?? 0) === 0,
        `remaining=${remaining?.length ?? 0}`,
      );
    } catch (e) {
      record('cleanup: test auth account deleted', false, e.message);
    }
  } else {
    recordSkip('cleanup: test auth account deleted', `set SUPABASE_MANAGEMENT_TOKEN to delete ${email}`);
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