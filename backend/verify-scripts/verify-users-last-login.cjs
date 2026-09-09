/**
 * Users.jsx "Last Login" column wiring verification.
 *
 * The column used to render a static "—" dash for every row. It now reads the
 * real `profiles.last_login_at` column, which is maintained by a SECURITY
 * DEFINER RPC (`record_login()`) called on sign-in / token refresh.
 *
 *   PART A — source checks
 *       a1) Users.jsx renders u.last_login_at (not a hardcoded dash)
 *       a2) Login.jsx calls the record_login() RPC after a successful sign-in
 *       a3) ProfileContext stamps last_login on SIGNED_IN / TOKEN_REFRESHED
 *       a4) a migration file adds profiles.last_login_at + record_login()
 *
 * Pure source checks — no DB credentials required.
 * Usage: node backend/verify-scripts/verify-users-last-login.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function readSrc(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}

function main() {
  const users = readSrc('pages/admin/Users.jsx');
  const login = readSrc('pages/auth/Login.jsx');
  const ctx = readSrc('context/ProfileContext.jsx');

  console.log('\n--- item: Last Login wiring ---');
  const a1 =
    users.includes('formatLastLogin(u.last_login_at)') &&
    users.includes("u.last_login_at") &&
    !/\{'—'\}/.test(users);
  record('a1) Users.jsx renders the real profiles.last_login_at (no hardcoded dash)', a1);

  const a2 =
    login.includes("supabase.rpc('record_login')") &&
    login.includes('signInWithPassword');
  record('a2) Login.jsx calls record_login() after a successful sign-in', a2);

  const a3 =
    ctx.includes("event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED'") &&
    ctx.includes("supabase.rpc('record_login')");
  record('a3) ProfileContext stamps last_login on SIGNED_IN / TOKEN_REFRESHED', a3);

  const sql = fs.readFileSync(
    path.join(ROOT, 'backend', 'sql', '19_profiles_last_login.sql'),
    'utf8',
  );
  const a4 =
    sql.includes('add column if not exists last_login_at timestamptz') &&
    sql.includes('create or replace function public.record_login()') &&
    sql.includes('security definer') &&
    sql.includes('grant execute on function public.record_login() to authenticated');
  record('a4) migration adds profiles.last_login_at + SECURITY DEFINER record_login()', a4);

  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

  process.exit(failures === 0 ? 0 : 1);
}

main();
