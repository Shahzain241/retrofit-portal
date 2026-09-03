/**
 * Client dashboard "Public dashboard" label removal verification.
 *
 *   a1) DashboardLayout.jsx no longer renders "Public dashboard" anywhere
 *       (it was an un-Figma label above every client page's content).
 *   a2) the string "Public dashboard" does not appear anywhere in src/ (not
 *       reused/relabelled on another page).
 *   a3) the removed label is not simply hidden in CSS — the now-unused
 *       `.rp-dash-page-title` rule is gone too.
 *   a4) the greeting banner ("Good morning ...") that the label sat above is
 *       still present in ClientDashboard.jsx (nothing else was lost).
 *
 * Pure source checks — no credentials required.
 * Usage: node backend/verify-scripts/verify-dashboard-title.cjs
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');

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

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(jsx?|tsx?|css|html)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function main() {
  console.log('\n--- "Public dashboard" label removal ---');

  const layout = readSrc('components/DashboardLayout.jsx');
  const a1 = !/Public dashboard/i.test(layout);
  record(
    'a1) DashboardLayout no longer renders "Public dashboard"',
    a1,
    a1 ? '' : 'the label is still present in DashboardLayout.jsx',
  );

  const allFiles = walk(SRC);
  const offenders = allFiles
    .filter((f) => /Public dashboard/i.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(SRC, f));
  record(
    'a2) "Public dashboard" not reused anywhere in src/',
    offenders.length === 0,
    offenders.length === 0 ? '' : `found in: ${offenders.join(', ')}`,
  );

  const sharedCss = readSrc('styles/DashboardShared.css');
  const a3 = !sharedCss.includes('.rp-dash-page-title');
  record(
    'a3) unused .rp-dash-page-title CSS rule removed (not hidden via CSS)',
    a3,
    a3 ? '' : 'the CSS rule that styled the removed label is still present',
  );

  const dash = readSrc('pages/client/ClientDashboard.jsx');
  const a4 =
    /Good morning\s*\{profile\.firstName\}/.test(dash) &&
    /dashboard-banner dashboard-banner-client/.test(dash);
  record(
    'a4) greeting banner still present in ClientDashboard (label above it removed)',
    a4,
    a4 ? '' : 'the greeting banner was altered or removed',
  );

  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

  process.exit(failures === 0 ? 0 : 1);
}

main();