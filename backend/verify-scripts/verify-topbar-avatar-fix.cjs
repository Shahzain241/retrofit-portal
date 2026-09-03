/**
 * Topbar avatar leak fix verification.
 *
 * The top-right avatar previously rendered whatever `profile.avatar` held
 * straight into an <img> with no validation or fallback, so a stale/garbage
 * value (e.g. a persisted toast/notification/error message) could render as
 * leaked/broken text inside the avatar circle. The fix renders the avatar via
 * a guarded `TopbarAvatar` that only ever shows a valid image or clean
 * initials — never the raw string.
 *
 *   a1) both admin and client avatars render through TopbarAvatar
 *       (no bare <img src={profile.avatar}> left)
 *   a2) the raw profile.avatar string is never rendered as text content
 *   a3) the guard exists: isImageSource validation + onError->initials fallback
 *   a4) async fetch/notification errors are NOT rendered into the UI
 *       (loadNotifications errors go to console.error only)
 *   a5) the leaked "Invitation sent, but the password-set email could not be
 *       delivered." string is used only inside showToast (its own component),
 *       never anywhere near the avatar
 *   b1) unit tests (src/test/TopbarAvatar.test.jsx) pass for accounts WITH and
 *       WITHOUT an uploaded avatar_url — incl. a garbage-string avatar that
 *       must not leak, and a failed image load that must swap to initials
 *
 * Pure source checks + a vitest run — no DB credentials required.
 * Usage: node backend/verify-scripts/verify-topbar-avatar-fix.cjs
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

function main() {
  console.log('\n--- Topbar avatar leak fix ---');

  const topbar = readSrc('components/Topbar.jsx');
  const invite = readSrc('pages/admin/InviteStaff.jsx');

  // a1) both variants use TopbarAvatar
  const a1 =
    topbar.includes('<TopbarAvatar') &&
    (topbar.match(/<TopbarAvatar/g) ?? []).length === 2 &&
    !topbar.includes('<img\n            src={profile.avatar}') &&
    !/<img\s+src=\{profile\.avatar\}/.test(topbar);
  record(
    'a1) admin + client avatars render via TopbarAvatar (no bare <img src={profile.avatar}>)',
    a1,
    a1 ? '' : 'a raw avatar <img> is still present',
  );

  // a2) raw avatar string never rendered as text content
  const a2 =
    !/>\{profile\.avatar\}</.test(topbar) &&
    !/>\{avatar\}</.test(topbar);
  record(
    'a2) profile.avatar is never rendered as text content (image or initials only)',
    a2,
    a2 ? '' : 'the raw avatar string is rendered as text somewhere',
  );

  // a3) guard + fallback present
  const a3 =
    topbar.includes('isImageSource(avatar)') &&
    topbar.includes('onError={() => setFailed(true)}') &&
    topbar.includes('getAvatarInitials(name)');
  record(
    'a3) guard present: isImageSource validation + onError -> initials fallback',
    a3,
    a3 ? '' : 'avatar validation or fallback is missing',
  );

  // a4) async fetch errors are not rendered into the UI
  const a4 =
    topbar.includes("console.error('[Topbar] failed to load notifications'") &&
    !/>\{error\.message\}</.test(topbar) &&
    !/>\{toast\.message\}</.test(topbar);
  record(
    'a4) async/notification errors go to console.error, not the UI',
    a4,
    a4 ? '' : 'an error/notification message is rendered into the UI',
  );

  // a5) leaked string only lives inside showToast in InviteStaff
  const leaked = 'Invitation sent, but the password-set email could not be delivered.';
  const a5 =
    invite.includes(`message: '${leaked}'`) &&
    !topbar.includes(leaked);
  record(
    'a5) leaked warning string exists only inside showToast (InviteStaff), never in Topbar',
    a5,
    a5 ? '' : 'the leaked string appears outside its toast usage',
  );

  // b1) unit tests pass (avatar with/without url, garbage string, load failure)
  console.log('\n--- unit tests (src/test/TopbarAvatar.test.jsx) ---');
  try {
    execFileSync(
      'npx vitest run src/test/TopbarAvatar.test.jsx',
      { cwd: path.join(__dirname, '..', '..'), stdio: 'inherit', timeout: 180000, shell: true },
    );
    record('b1) TopbarAvatar unit tests pass (image, no-avatar, garbage string, img error)', true);
  } catch (e) {
    record('b1) TopbarAvatar unit tests pass (image, no-avatar, garbage string, img error)', false, e.message);
  }

  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

  process.exit(failures === 0 ? 0 : 1);
}

main();