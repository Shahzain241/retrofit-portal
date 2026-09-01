/**
 * Topbar notifications + apps menu verification.
 *
 * NOTIFICATIONS (Topbar bell):
 *   - real `notifications` rows are created by EXISTING app events via DB
 *     triggers (project_messages insert, project_deliverables ready=true)
 *   - the bell fetches the real unread count for auth.uid()
 *   - marking a notification read persists, and it leaves the unread list
 *   - RLS blocks reading another user's notifications
 *
 * APPS MENU:
 *   - items are role/layout-aware: the client dashboard shows the 4 client
 *     sidebar destinations, the admin dashboard shows only admin destinations,
 *     and the lists are derived from data/sidebarLinks.js so they never leak
 *   - items that map to real internal routes navigate there
 *
 *   PART A — source checks (no browser harness)
 *       a1) Topbar fetches unread notifications from `notifications` scoped to
 *           auth.uid() + is_read=false, and the badge uses that count
 *       a2) clicking a notification marks is_read=true and navigates to its
 *           link (if present)
 *       a3) the apps menu is role/layout-aware: lists derived from
 *           data/sidebarLinks.js (client/admin) and selected by layout variant
 *
 *   PART B — live checks
 *       b1) a client message insert triggers a real notification row for staff
 *           (checked on a dedicated coordinator test user)
 *       b2) a staff message insert triggers a real notification row for the
 *           project's client owner
 *       b3) a deliverable becoming ready=true triggers exactly one notification
 *           for the project owner (not on ready=false insert, no dup on re-update)
 *       b4) the unread count fetched by Topbar is accurate
 *       b5) marking a notification read persists (leaves the unread list; DB
 *           row confirms is_read=true)
 *       b6) RLS blocks reading another user's notifications (0 rows)
 *
 * Requires backend/sql/13_notifications_table.sql (table + RLS + triggers).
 *
 * Credentials come from env vars (see backend/.env.example):
 *   VITE_SUPABASE_ANON_KEY, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * SUPABASE_MANAGEMENT_TOKEN is optional — used only to delete the test
 * auth accounts. Usage: node backend/verify-scripts/verify-topbar.cjs
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
const TOPBAR_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'components', 'Topbar.jsx'),
  'utf8',
);

// --- PART A: source checks -----------------------------------------------------
function partA() {
  console.log('\n--- PART A: source checks ---');

  const a1 =
    TOPBAR_SRC.includes("from('notifications')") &&
    TOPBAR_SRC.includes(".eq('user_id', uid)") &&
    TOPBAR_SRC.includes(".eq('is_read', false)") &&
    TOPBAR_SRC.includes('const unreadCount = notifications.length') &&
    !TOPBAR_SRC.includes('topbarNotifications');
  record(
    'a1) Topbar fetches real unread notifications + badge uses the count',
    a1,
    a1 ? '' : 'Topbar is not fetching unread notifications for auth.uid() or still uses static misc data',
  );

  const a2 =
    TOPBAR_SRC.includes(".update({ is_read: true })") &&
    TOPBAR_SRC.includes("if (n.link) navigate(n.link)");
  record(
    'a2) clicking a notification marks is_read=true and navigates to its link',
    a2,
    a2 ? '' : 'notification click is missing mark-read and/or link navigation',
  );

  const a3 =
    TOPBAR_SRC.includes("import { clientLinks, adminLinks } from '../data/sidebarLinks'") &&
    TOPBAR_SRC.includes('const CLIENT_APPS = clientLinks.map') &&
    TOPBAR_SRC.includes('const ADMIN_APPS = adminLinks.map') &&
    /\(variant === 'admin' \? ADMIN_APPS : CLIENT_APPS\)\.map/.test(TOPBAR_SRC) &&
    !TOPBAR_SRC.includes('TOPBAR_APPS');
  record(
    'a3) apps items come from the role-aware sidebar link lists (client/admin) and navigate to real routes',
    a3,
    a3 ? '' : 'apps menu is not role-aware / still uses static misc data',
  );
}

// --- PART B: live checks ---------------------------------------------------------
async function partB() {
  console.log('\n--- PART B: live checks ---');
  const stamp = Date.now().toString(36);
  const projectId = `NOTIFPRJ-${stamp}`;
  const clientAEmail = `notif-a-${stamp}@verify.test`;
  const coordinatorEmail = `notif-staff-${stamp}@verify.test`;
  const createdEmails = [clientAEmail, coordinatorEmail];
  const projectLink = `/projects/${projectId}`;

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

  const clientA = await makeClient(clientAEmail);
  const coordinator = await makeClient(coordinatorEmail);
  const clientAId = (await clientA.auth.getUser()).data.user.id;
  const coordinatorId = (await coordinator.auth.getUser()).data.user.id;

  // Promote the coordinator test user to a staff role (super-admin allowed).
  const { error: roleErr } = await admin
    .from('profiles')
    .update({ role: 'coordinator' })
    .eq('id', coordinatorId);
  if (roleErr) throw new Error(`promote coordinator: ${roleErr.message}`);
  console.log('setup: client A', clientAEmail, clientAId);
  console.log('setup: coordinator (staff)', coordinatorEmail, coordinatorId);

  // Seed a project owned by client A.
  const { error: seedErr } = await admin.from('projects').insert({
    id: projectId,
    name: 'Notif Seed',
    status: 'active',
    progress: 0,
    address_line1: '1 Notif St',
    address_city: 'London',
    address_postcode: 'SW1A 1AA',
    service: 'HVAC Retrofit',
    client_id: clientAId,
  });
  record('seed: test project created for client A', !seedErr, seedErr ? seedErr.message : projectId);
  const seedingOk = !seedErr;
  if (!seedingOk) {
    recordSkip('b1-b6) live notification checks', 'seeding failed');
  }

  const unreadFor = async (client, uid) => client
    .from('notifications')
    .select('*')
    .eq('user_id', uid)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(20);

  // --- b1) client message -> notification for staff (coordinator) --------------
  const clientMsg = await clientA.from('project_messages').insert({
    project_id: projectId,
    sender_id: clientAId,
    body: 'Please review the draft survey.',
    type: 'message',
  });
  const staffNotifs = await admin
    .from('notifications')
    .select('*')
    .eq('user_id', coordinatorId);
  const staffRow = (staffNotifs.data ?? []).find((n) => n.link === projectLink);
  const b1 =
    !clientMsg.error &&
    !staffNotifs.error &&
    !!staffRow &&
    staffRow.title === 'New project message' &&
    staffRow.body === 'Please review the draft survey.' &&
    staffRow.is_read === false;
  record(
    'b1) client message creates a real notification row for staff',
    b1,
    clientMsg.error?.message || staffNotifs.error?.message || `title=${staffRow?.title} link=${staffRow?.link}`,
  );

  // --- b2) staff message -> notification for the client owner ------------------
  const staffMsg = await coordinator.from('project_messages').insert({
    project_id: projectId,
    sender_id: coordinatorId,
    body: 'Survey reviewed — all good.',
    type: 'message',
  });
  const clientNotifsAfterMsg = await admin
    .from('notifications')
    .select('*')
    .eq('user_id', clientAId);
  const clientMsgRow = (clientNotifsAfterMsg.data ?? []).find((n) => n.title === 'New project message');
  const b2 =
    !staffMsg.error &&
    !clientNotifsAfterMsg.error &&
    !!clientMsgRow &&
    clientMsgRow.body === 'Survey reviewed — all good.' &&
    clientMsgRow.user_id === clientAId &&
    clientMsgRow.link === projectLink;
  record(
    'b2) staff message creates a real notification row for the client owner',
    b2,
    staffMsg.error?.message || clientNotifsAfterMsg.error?.message || `row=${JSON.stringify(clientMsgRow)}`,
  );

  // --- b3) deliverable ready -> exactly one notification for the owner ---------
  const { data: delivData, error: delivErr } = await admin.from('project_deliverables').insert({
    project_id: projectId,
    title: 'EPC Pre-Retrofit Report',
    description: 'Baseline certificate.',
    file_type: 'pdf',
    ready: false,
    sort_order: 1,
  }).select('id').single();
  const delivId = delivData?.id;
  const unreadAfterInsertReadyFalse = await unreadFor(clientA, clientAId);
  const countAfterFalse = (unreadAfterInsertReadyFalse.data ?? []).filter((n) => n.title === 'Deliverable ready' && n.link === projectLink).length;

  const { error: readyUpdErr } = await admin
    .from('project_deliverables')
    .update({ ready: true })
    .eq('id', delivId);
  const unreadAfterReady = await unreadFor(clientA, clientAId);
  const readyNotifs = (unreadAfterReady.data ?? []).filter((n) => n.title === 'Deliverable ready' && n.link === projectLink);
  const deliverableBody = 'EPC Pre-Retrofit Report';

  const { error: readyUpd2Err } = await admin
    .from('project_deliverables')
    .update({ ready: true })
    .eq('id', delivId);
  const unreadAfterReReady = await unreadFor(clientA, clientAId);
  const readyNotifsAfterDup = (unreadAfterReReady.data ?? []).filter((n) => n.title === 'Deliverable ready' && n.link === projectLink);

  const b3 =
    !delivErr &&
    !readyUpdErr &&
    !readyUpd2Err &&
    countAfterFalse === 0 &&
    readyNotifs.length === 1 &&
    readyNotifs[0].body === deliverableBody &&
    readyNotifs[0].user_id === clientAId &&
    readyNotifsAfterDup.length === 1;
  record(
    'b3) deliverable ready=true triggers exactly one notification (not on ready=false, no dup)',
    b3,
    delivErr?.message || readyUpdErr?.message || `notif-on-false=${countAfterFalse} after-ready=${readyNotifs.length} after-dup=${readyNotifsAfterDup.length}`,
  );

  // --- b4) unread count fetched by Topbar is accurate ---------------------------
  const topbarFetch = await unreadFor(clientA, clientAId);
  const expectedUnread = 2; // staff message + deliverable ready
  record(
    'b4) Topbar unread count is accurate',
    !topbarFetch.error && (topbarFetch.data?.length ?? 0) === expectedUnread,
    topbarFetch.error ? topbarFetch.error.message : `unread=${topbarFetch.data?.length ?? 0}`,
  );

  // --- b5) marking read persists ------------------------------------------------
  const targetNotif = (topbarFetch.data ?? []).find((n) => n.title === 'Deliverable ready');
  const markRead = await clientA
    .from('notifications')
    .update({ is_read: true })
    .eq('id', targetNotif?.id)
    .eq('user_id', clientAId);
  const afterMark = await unreadFor(clientA, clientAId);
  const { data: dbRow, error: dbRowErr } = await admin
    .from('notifications')
    .select('is_read')
    .eq('id', targetNotif?.id)
    .single();
  record(
    'b5) marking read persists (leaves unread list; DB row is_read=true)',
    !markRead.error &&
      !afterMark.error &&
      !dbRowErr &&
      dbRow?.is_read === true &&
      (afterMark.data ?? []).length === expectedUnread - 1,
    markRead.error?.message || dbRowErr?.message || `unread-after=${afterMark.data?.length ?? 0} db-read=${dbRow?.is_read}`,
  );

  // --- b6) RLS blocks reading another user's notifications ------------------------
  const crossStaffRead = await coordinator
    .from('notifications')
    .select('*')
    .eq('user_id', clientAId);
  const crossClientRead = await clientA
    .from('notifications')
    .select('*')
    .eq('user_id', coordinatorId);
  record(
    'b6) RLS blocks reading another user\'s notifications (0 rows)',
    !crossStaffRead.error && (crossStaffRead.data?.length ?? 0) === 0 &&
      !crossClientRead.error && (crossClientRead.data?.length ?? 0) === 0,
    `staff-could-see=${crossStaffRead.data?.length ?? 0} client-could-see=${crossClientRead.data?.length ?? 0}`,
  );

  // --- cleanup ---------------------------------------------------------------------
  console.log('\n--- cleanup ---');
  const { error: notifCleanup } = await admin
    .from('notifications')
    .delete()
    .eq('link', projectLink);
  const { error: delivCleanup } = await admin
    .from('project_deliverables')
    .delete()
    .eq('project_id', projectId);
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
    'cleanup: notifications + deliverables + messages + project deleted',
    !notifCleanup && !delivCleanup && !msgCleanup && !projCleanup && (leftover?.length ?? 0) === 0,
    notifCleanup?.message || delivCleanup?.message || msgCleanup?.message || projCleanup?.message || `remaining=${leftover?.length ?? 0}`,
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