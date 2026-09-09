/**
 * User Directory (admin) Figma gap verification — items 1-5 plus the
 * Action-column audit from the cleanup task.
 *
 *   item1) Selected sidebar nav item has a thin green left-edge accent bar
 *   item2) Users table header uses a dashed/dotted separator (not solid)
 *   item3) Status column has conditional styling for offline (gray/muted),
 *          not just active-always-green
 *   item4) Topbar avatar fix is present AND used on this route (guarded
 *          TopbarAvatar + sanitizeAvatar rejecting the broken ui-avatars.com
 *          placeholder)
 *   item5) Sidebar collapse/expand toggle is a rounded square (rounded-xl),
 *          not a full circle
 *   item6) Action-column audit (source):
 *            - impersonate (LogIn) is an honest DISABLED "Coming soon" control
 *            - edit (Pencil) opens a Modal and persists via real profiles UPDATE
 *            - ban (Ban) opens a confirmation Modal and persists is_banned
 *            - no fake/placeholder toasts remain
 *
 * Pure source checks — no DB credentials required.
 * Usage: node backend/verify-scripts/verify-user-directory-figma.cjs
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

function main() {
  const shared = readSrc('styles/DashboardShared.css');
  const users = readSrc('pages/admin/Users.jsx');
  const topbar = readSrc('components/Topbar.jsx');
  const ctx = readSrc('context/ProfileContext.jsx');

  console.log('\n--- item 1: selected nav accent bar ---');
  const i1 =
    shared.includes('a.rp-sidebar-link-active') &&
    /border-left\s*:\s*4px\s+solid\s+#12b14e/i.test(shared);
  record('item1) active nav link has a thin green left-edge accent bar', i1);

  console.log('\n--- item 2: dashed table header separator ---');
  const i2 =
    users.includes('border-dashed') &&
    users.includes('border-gray-200');
  record('item2) Users table header uses a dashed separator (not solid)', i2);

  console.log('\n--- item 3: offline status styling ---');
  const i3 =
    users.includes("u.status === 'active'") &&
    users.includes('rp-table-td-success') &&
    /text-muted/.test(users);
  record('item3) Status column styles offline/inactive as gray/muted (not always green)', i3);

  console.log('\n--- item 4: topbar avatar fix present + used on this route ---');
  const i4a =
    topbar.includes('<TopbarAvatar') &&
    !/<img\s+src=\{profile\.avatar\}/.test(topbar) &&
    !/>\{profile\.avatar\}</.test(topbar);
  record('item4a) Topbar renders the avatar via guarded TopbarAvatar (no raw leak)', i4a);
  const i4b =
    ctx.includes('sanitizeAvatar') &&
    /ui-avatars\.com/i.test(ctx);
  record('item4b) sanitizeAvatar rejects the broken ui-avatars.com placeholder', i4b);

  console.log('\n--- item 5: sidebar collapse toggle is a rounded square ---');
  const sidebar = readSrc('components/Sidebar.jsx');
  const i5 =
    sidebar.includes('rounded-xl') &&
    sidebar.includes('onToggleCollapse') &&
    !/rounded-full[\s\S]{0,200}onToggleCollapse/.test(sidebar);
  record('item5) collapse/expand toggle is a rounded square (rounded-xl), not a full circle', i5);

  console.log('\n--- item 6: Action column audit (source) ---');
  const i6a =
    users.includes('aria-label="Log in as user"') &&
    users.includes('disabled') &&
    users.includes('title="Coming soon"') &&
    !users.includes('Impersonating user');
  record('item6a) impersonate (LogIn) is a disabled "Coming soon" placeholder (no fake action)', i6a);
  const i6b =
    users.includes('title="Edit User"') &&
    users.includes("from('profiles')") &&
    users.includes('.update({ full_name: editName.trim(), role: editRole })') &&
    users.includes(".eq('id', editingUser.id)");
  record('item6b) edit (Pencil) opens a Modal and persists via real profiles UPDATE', i6b);
  const i6c =
    users.includes('title={banUser?.is_banned ? \'Unban User\' : \'Ban User\'}') &&
    users.includes('.update({ is_banned: next })') &&
    users.includes(".eq('id', banUser.id)");
  record('item6c) ban (Ban) opens a confirmation Modal and persists is_banned', i6c);
  const i6d =
    !users.includes("message: 'Impersonating user'") &&
    !users.includes("message: 'Editing user'") &&
    !users.includes("message: 'User banned'");
  record('item6d) no leftover fake/placeholder action toasts', i6d);

  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

  process.exit(failures === 0 ? 0 : 1);
}

main();
