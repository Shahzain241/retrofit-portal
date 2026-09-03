/**
 * Client dashboard sidebar sizing verification.
 *
 * The shared sidebar rail was narrowed from 250px to 232px and made more
 * compact (tighter nav padding/vertical rhythm, fixed-width inner elements
 * scaled to fit the narrower rail). Navigation logic, routes and the
 * active-state behaviour must be untouched.
 *
 *   a1) expanded rail width is 232px (narrower than the old 250px)
 *   a2) collapsed rail width is unchanged (76px icon-only)
 *   a3) nav row padding + vertical spacing tightened (px-3, space-y-0.5, py-2.5)
 *   a4) fixed-width inner elements scaled to fit the narrower rail
 *       (brand margin, divider, "New Project" button all fit inside 232px)
 *   a5) DashboardLayout content margin matches the new rail width
 *   a6) nav logic untouched: links still come from client/admin link maps
 *       via NavLink, active-pill class + collapse toggle + NewProjectModal
 *       wiring still present
 *
 * Pure source checks — no credentials required.
 * Usage: node backend/verify-scripts/verify-dashboard-sidebar.cjs
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
  console.log('\n--- Sidebar sizing ---');

  const sidebar = readSrc('components/Sidebar.jsx');
  const shared = readSrc('styles/DashboardShared.css');
  const layout = readSrc('components/DashboardLayout.jsx');

  // a1) expanded width narrowed 250px -> 232px
  const a1 =
    sidebar.includes("'w-[232px]'") &&
    !sidebar.includes("'w-[250px]'") &&
    !sidebar.includes('w-[250px]');
  record(
    'a1) expanded rail narrowed to 232px (old 250px gone)',
    a1,
    a1 ? '' : 'rail width class did not change to 232px',
  );

  // a2) collapsed state untouched
  const a2 = sidebar.includes("'is-collapsed w-[76px]'");
  record(
    'a2) collapsed rail unchanged (76px icon-only)',
    a2,
    a2 ? '' : 'collapsed width class was altered',
  );

  // a3) tighter nav row padding + vertical rhythm
  const a3 =
    sidebar.includes('<nav className="flex-1 px-3 space-y-0.5">') &&
    sidebar.includes('py-2.5 text-sm font-medium');
  record(
    'a3) nav padding/vertical spacing tightened (px-3, space-y-0.5, py-2.5)',
    a3,
    a3 ? '' : 'nav row classes were not tightened',
  );

  // a4) fixed-width inner elements fit inside 232px rail
  //     available content width = 232 - 2*12 (nav px-3) = 208px
  const brandMargin = /margin-left:\s*(\d+(?:\.\d+)?)px/.exec(shared);
  const dividerWidth = /\.rp-sidebar-divider\s*{[\s\S]*?width:\s*(\d+)px/.exec(shared);
  const btnWidth = /\.rp-sidebar-newproject\s*{[\s\S]*?width:\s*(\d+)px/.exec(shared);
  const a4 =
    brandMargin !== null &&
    Number(brandMargin[1]) < 98.59 &&
    dividerWidth !== null &&
    Number(dividerWidth[1]) <= 208 &&
    btnWidth !== null &&
    Number(btnWidth[1]) <= 208;
  record(
    'a4) inner fixed widths scaled to fit narrower rail (brand/divider/button <= 208px)',
    a4,
    brandMargin && dividerWidth && btnWidth
      ? `brand=${brandMargin[1]} divider=${dividerWidth[1]} button=${btnWidth[1]}`
      : 'could not parse fixed widths',
  );

  // a5) content column margin tracks the new width
  const a5 =
    layout.includes("'lg:ml-[232px]'") &&
    !layout.includes("lg:ml-[250px]");
  record(
    'a5) DashboardLayout content margin matches new rail width (232px)',
    a5,
    a5 ? '' : 'content margin still references the old 250px width',
  );

  // a6) navigation logic untouched
  const a6 =
    sidebar.includes("clientLinks, adminLinks") &&
    sidebar.includes('<NavLink') &&
    sidebar.includes('rp-sidebar-link-active') &&
    sidebar.includes('onToggleCollapse') &&
    sidebar.includes("setNewProjectOpen(true)");
  record(
    'a6) nav logic intact: link maps, NavLink, active pill, collapse toggle, NewProject modal',
    a6,
    a6 ? '' : 'navigation wiring was altered',
  );

  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

  process.exit(failures === 0 ? 0 : 1);
}

main();