/**
 * InviteStaff permission toggles verification.
 *
 * The two permission switches (View all projects / Assign to specific projects)
 * were static <Toggle> buttons with no onClick — they LOOKED interactive but
 * did nothing when clicked, with no "Coming soon" marker and no backing table.
 * They are now honestly disabled with a visible "Coming soon" label.
 *
 *   a1) both permission toggles are disabled + labelled "Coming soon"
 *   a2) no permission is persisted / no onClick is bound to them (they can't
 *       pretend to save)
 *   a3) the shared Toggle component supports a disabled state
 *
 * Pure source checks — no credentials required.
 * Usage: node backend/verify-scripts/verify-invite-permissions.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
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
  const INVITE_SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'pages', 'admin', 'InviteStaff.jsx'),
    'utf8',
  );
  const TOGGLE_SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'components', 'Toggle.jsx'),
    'utf8',
  );

  const a1 =
    INVITE_SRC.includes('View all projects permission" on size="lg" disabled') &&
    INVITE_SRC.includes('Assign to specific projects permission" on={false} size="lg" disabled') &&
    (INVITE_SRC.match(/Coming soon/g) ?? []).length >= 2;
  record(
    'a1) both permission toggles are disabled + labelled "Coming soon"',
    a1,
    a1 ? '' : 'a permission toggle is still enabled-looking or lacks the label',
  );

  const a2 =
    INVITE_SRC.includes('Permissions are not saved yet') &&
    !INVITE_SRC.includes('.from(\'permissions\')') &&
    !INVITE_SRC.includes('permissions:') &&
    !INVITE_SRC.includes('aria-label="View all projects permission" onClick');
  record(
    'a2) permissions are explicitly not saved (no write path, no fake onClick)',
    a2,
    a2 ? '' : 'a permission write path or click handler still exists',
  );

  const a3 =
    TOGGLE_SRC.includes('disabled = false') &&
    TOGGLE_SRC.includes('disabled={disabled}') &&
    TOGGLE_SRC.includes('rp-toggle-disabled');
  record(
    'a3) shared Toggle supports a disabled state',
    a3,
    a3 ? '' : 'Toggle component has no disabled support',
  );

  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

  process.exit(failures === 0 ? 0 : 1);
}

main();