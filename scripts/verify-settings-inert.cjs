/**
 * Settings.jsx honesty verification.
 *
 * The Settings page previously mixed invented/static data with controls that
 * LOOKED interactive but did nothing:
 *   - the rich-text toolbar icons (Bold/Italic/List) appeared clickable but
 *     were silent no-ops
 *   - the "Integration Health" cards showed fabricated statuses ("Connected",
 *     "Last ping: 2 mins ago") with no demo marker
 *   - the email-template save is localStorage-only (no DB table), which was
 *     not disclosed in the UI
 *
 * All of those are now honest: toolbar icons are inert "Coming soon", the
 * integration cards carry a "Demo data" note, and the email editor discloses
 * that it is saved locally only.
 *
 *   a1) toolbar icons are inert + "Coming soon" (opacity/cursor-not-allowed)
 *   a2) integration health is labelled "Demo data"
 *   a3) email template save discloses localStorage-only persistence
 *
 * Pure source checks — no credentials required.
 * Usage: node scripts/verify-settings-inert.cjs
 */

const fs = require('fs');
const path = require('path');

const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function main() {
  const SETTINGS_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'pages', 'admin', 'Settings.jsx'),
    'utf8',
  );

  const toolbarCount = (SETTINGS_SRC.match(/opacity-40 cursor-not-allowed" title="Coming soon" \/>/g) ?? []).length;
  const a1 =
    toolbarCount === 3 &&
    !SETTINGS_SRC.includes('<Bold size={14} className="text-body" />');
  record(
    'a1) toolbar icons (Bold/Italic/List) are inert + "Coming soon"',
    a1,
    a1 ? '' : `inert icons=${toolbarCount} (expected 3)`,
  );

  const a2 =
    SETTINGS_SRC.includes('Demo data — no live integrations are configured in this environment.');
  record(
    'a2) Integration Health cards are labelled "Demo data"',
    a2,
    a2 ? '' : 'integration cards still present fabricated statuses without a demo marker',
  );

  const a3 =
    SETTINGS_SRC.includes('Demo — saved locally in this browser, not synced to a database.');
  record(
    'a3) email template save discloses localStorage-only persistence',
    a3,
    a3 ? '' : 'email template save does not disclose its localStorage-only nature',
  );

  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

  process.exit(failures === 0 ? 0 : 1);
}

main();