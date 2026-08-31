/**
 * Profile.jsx email-change verification.
 *
 * Verifies the email-change wiring added to Profile.jsx + ProfileContext.jsx:
 *
 *   PART A — Profile.jsx source checks
 *     (the component is ESM JSX and can't be imported into a plain Node script,
 *     so render + client-side validation are verified against the shipped source)
 *       a1) an edit-email affordance renders (EDIT toggle, New Email input,
 *           Update Email button)
 *       a2) validation rejects invalid / unchanged emails before the call
 *       a3) the form submits through supabase.auth.updateUser({ email })
 *       a4) success shows a confirmation-link message and does NOT touch
 *           profiles.email (deferred until confirmation)
 *       a5) errors surface the Supabase error message via the toast path
 *
 *   PART B — ProfileContext.jsx sync checks
 *       b1) the existing onAuthStateChange listener handles USER_UPDATED
 *       b2) it mirrors a changed user.email back to the profiles row
 *       b3) still a single listener (no second onAuthStateChange created)
 *
 *   PART C — live Supabase flow (real project)
 *       c1) updateUser({ email }) resolves without error. The mailer must be
 *           working to deliver the change email; if GoTrue reports a
 *           mailer/infrastructure error ("Error sending email change email",
 *           etc.) this is recorded as SKIP (environment limitation), not FAIL.
 *       c2) profiles.email is NOT changed by the updateUser call itself
 *           (the write is deferred until the confirmation link is clicked)
 *       c3) the sync write itself works for a client (update own profiles.email,
 *           persisted + visible to super-admin)
 *       c4) an invalid email surfaces a Supabase error
 *
 *   NOTE: the full end-to-end path (clicking the confirmation link in the new
 *   inbox → USER_UPDATED → profiles.email sync) can't be exercised here without
 *   a live mailbox, so that leg is intentionally stubbed: it is covered by the
 *   Part B source checks plus c3, which runs the exact sync write against the
 *   real database.
 *
 * Credentials come from env vars (see .env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 *
 * Cleanup: the throwaway client account is only deleted when
 * SUPABASE_MANAGEMENT_TOKEN is set; otherwise left in place.
 *
 * Usage: node scripts/verify-profile-email.cjs
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

// GoTrue mailer/infrastructure failures (e.g. "Error sending email change
// email") mean the change was accepted but the confirmation email couldn't be
// delivered — an environment limitation, not an app regression.
function isMailerInfraError(error) {
  if (!error || typeof error.message !== 'string') return false;
  return (
    /error sending/i.test(error.message) ||
    /email.*(not configured|provider|smtp)/i.test(error.message)
  );
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
  path.join(__dirname, '..', 'src', 'pages', 'client', 'Profile.jsx'),
  'utf8',
);
const CTX_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'context', 'ProfileContext.jsx'),
  'utf8',
);
const idx = (src, needle) => src.indexOf(needle);
const count = (src, needle) => src.split(needle).length - 1;

function handleEmailChangeSource(src) {
  const start = idx(src, 'function handleEmailChange');
  if (start < 0) return '';
  const end = src.indexOf('\n  function ', start + 1);
  return src.slice(start, end > start ? end : start + 4000);
}

// --- PART A: Profile.jsx email form (source checks) ----------------------------
function partA() {
  console.log('\n--- PART A: Profile.jsx email change form (source checks) ---');

  const a1 = idx(PROFILE_SRC, 'setEditingEmail((v) => !v)') >= 0 &&
    PROFILE_SRC.includes("editingEmail ? 'CANCEL' : 'EDIT'") &&
    idx(PROFILE_SRC, 'profile-new-email') >= 0 &&
    PROFILE_SRC.includes('New Email') &&
    PROFILE_SRC.includes('Update Email');
  record(
    'a1) edit-email affordance renders (EDIT toggle + New Email input + Update Email button)',
    a1,
    a1 ? '' : 'missing EDIT toggle / New Email input / Update Email button in Profile.jsx',
  );

  const emailFn = handleEmailChangeSource(PROFILE_SRC);
  const updateIdx = idx(emailFn, 'updateUser({ email })');
  const formatIdx = idx(emailFn, '/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)');
  const sameIdx = idx(emailFn, 'email.toLowerCase() === form.email.toLowerCase()');
  const a2 = formatIdx >= 0 && sameIdx >= 0 && updateIdx >= 0 && formatIdx < updateIdx && sameIdx < updateIdx;
  record(
    'a2) validation rejects invalid / unchanged emails before the Supabase call',
    a2,
    a2 ? '' : `format@${formatIdx} same@${sameIdx} update@${updateIdx}`,
  );

  const a3 = emailFn.includes('supabase.auth') && updateIdx >= 0;
  record(
    'a3) form submits through supabase.auth.updateUser({ email })',
    a3,
    a3 ? '' : 'updateUser({ email }) call not found in handleEmailChange',
  );

  const a4 = emailFn.toLowerCase().includes('confirmation link') &&
    emailFn.includes('setEmailNote') &&
    !emailFn.includes("from('profiles')");
  record(
    'a4) success shows a confirmation-link message and does NOT update profiles.email',
    a4,
    a4 ? '' : 'missing confirmation-link message and/or handler still writes profiles.email',
  );

  const a5 = emailFn.includes('error.message') && emailFn.includes("'Could not update email.'");
  record(
    'a5) error path surfaces the Supabase error message via the toast path',
    a5,
    a5 ? '' : 'missing error-message toast wiring in handleEmailChange',
  );
}

// --- PART B: ProfileContext.jsx sync (source checks) ----------------------------
function partB() {
  console.log('\n--- PART B: ProfileContext.jsx USER_UPDATED sync (source checks) ---');

  const b1 = idx(CTX_SRC, 'onAuthStateChange') >= 0 && idx(CTX_SRC, 'USER_UPDATED') >= 0;
  record(
    'b1) onAuthStateChange listener handles the USER_UPDATED event',
    b1,
    b1 ? '' : 'USER_UPDATED handling not found in ProfileContext.jsx',
  );

  const b2 = idx(CTX_SRC, 'update({ email: session.user.email })') >= 0 &&
    idx(CTX_SRC, 'session.user.email !== profileRef.current.email') >= 0 &&
    idx(CTX_SRC, "from('profiles')") >= 0 &&
    idx(CTX_SRC, 'eq(\'id\', session.user.id)') >= 0;
  record(
    'b2) sync mirrors a changed user.email back to the profiles row',
    b2,
    b2 ? '' : 'profiles.email sync write not found in ProfileContext.jsx',
  );

  const listenerCount = count(CTX_SRC, 'onAuthStateChange');
  const b3 = listenerCount === 1;
  record(
    'b3) still a single onAuthStateChange listener (no second one added)',
    b3,
    `listener count in ProfileContext.jsx = ${listenerCount}`,
  );
}

// --- PART C: live Supabase flow -------------------------------------------------
async function partC() {
  const stamp = Date.now().toString(36);
  const oldEmail = `emailchg-${stamp}@verify.test`;
  const newEmail = `emailchg-${stamp}-new@verify.test`;

  console.log('\n--- PART C: live Supabase email-change flow ---');

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

  const client = createClient(URL, ANON, CLIENT_OPTIONS);
  const { data, error: signupErr } = await client.auth.signUp({
    email: oldEmail,
    password: 'VerifyPass123!',
  });
  if (signupErr || !data?.user?.id) {
    throw new Error(`throwaway client signup ${oldEmail}: ${signupErr?.message}`);
  }
  if (adminSession) {
    await admin.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });
  }
  const userId = data.user.id;
  console.log('setup: throwaway client', oldEmail, userId);

  const { data: before } = await admin.from('profiles').select('email').eq('id', userId).single();
  const baselineEmail = before?.email ?? null;

  // --- c1) updateUser({ email }) succeeds --------------------------------------
  const upd = await client.auth.updateUser({ email: newEmail });
  if (!upd.error && !!upd.data?.user) {
    record(
      'c1) updateUser({ email }) resolves without error',
      true,
      `user=${upd.data.user.email} new_email=${upd.data.user.new_email ?? '(none)'}`,
    );
  } else if (isMailerInfraError(upd.error)) {
    recordSkip(
      'c1) updateUser({ email }) resolves without error',
      `Supabase mailer unavailable (infra): ${upd.error.message}`,
    );
  } else {
    record(
      'c1) updateUser({ email }) resolves without error',
      false,
      upd.error ? upd.error.message : 'no user returned',
    );
  }

  // --- c2) profiles.email is NOT changed by the updateUser call itself ---------
  // The component defers the profiles write until the confirmation link is
  // clicked (handled by the USER_UPDATED sync), so right after updateUser the
  // profiles row must still hold the original email.
  const { data: after } = await admin.from('profiles').select('email').eq('id', userId).single();
  record(
    'c2) profiles.email unchanged immediately after updateUser (deferred to confirmation)',
    (after?.email ?? null) === baselineEmail,
    `baseline=${baselineEmail} after=${after?.email ?? null}`,
  );

  // --- c3) the sync write works for a client (permission + persistence) --------
  // Mirrors exactly what the USER_UPDATED handler runs after confirmation:
  //   supabase.from('profiles').update({ email: user.email }).eq('id', user.id)
  const syncWrite = await client
    .from('profiles')
    .update({ email: newEmail })
    .eq('id', userId)
    .select('email');
  const { data: afterSync } = await admin.from('profiles').select('email').eq('id', userId).single();
  record(
    'c3) the USER_UPDATED sync write works for a client (profiles.email updated + persisted)',
    (syncWrite.data ?? [])[0]?.email === newEmail && afterSync?.email === newEmail,
    syncWrite.error ? syncWrite.error.message : `profiles.email now=${afterSync?.email ?? null}`,
  );

  // --- c4) invalid email surfaces a Supabase error ------------------------------
  const bad = await client.auth.updateUser({ email: 'definitely-not-an-email' });
  record(
    'c4) invalid email surfaces a Supabase error (component error path)',
    !!bad.error && typeof bad.error.message === 'string' && bad.error.message.length > 0,
    bad.error ? bad.error.message : 'no error returned',
  );

  // --- cleanup ------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  if (MGMT_TOKEN) {
    try {
      await runQuery(`delete from public.profiles where id = '${userId}';`);
      await runQuery(`delete from auth.users where id = '${userId}';`);
      const remaining = await runQuery(
        `select id from auth.users where id = '${userId}';`,
      );
      record(
        'cleanup: throwaway client deleted',
        (remaining?.length ?? 0) === 0,
        `remaining=${remaining?.length ?? 0}`,
      );
    } catch (e) {
      record('cleanup: throwaway client deleted', false, e.message);
    }
  } else {
    console.log(`  SKIP  cleanup of throwaway client — set SUPABASE_MANAGEMENT_TOKEN to delete ${oldEmail}`);
  }
}

async function main() {
  partA();
  partB();
  await partC();

  console.log('\nNOTE: full end-to-end email confirmation (clicking the link in the new');
  console.log('inbox → USER_UPDATED → profiles.email sync) requires a live mailbox and');
  console.log('is intentionally NOT exercised live; it is covered by the Part B source');
  console.log('checks plus c3, which runs the exact sync write against the real DB.');

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