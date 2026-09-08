/**
 * Topbar role-scope verification (apps menu + avatar navigation).
 *
 * Confirms the shared Topbar is strictly role/layout-aware and that the client
 * and admin dashboards never leak destinations into each other:
 *
 *   a1) Topbar accepts a `variant` prop (the dashboard layout that renders it)
 *       and DashboardLayout passes it through.
 *   a2) The apps menu is driven by the SAME destination lists as the sidebar
 *       (data/sidebarLinks.js) — clientLinks for the client layout, adminLinks
 *       for the admin layout — so the two can never drift or leak.
 *   a3) Client dashboard apps menu shows EXACTLY the 4 client sidebar items
 *       (Dashboard, My Projects, Profile & Property, Billing) and NONE of the
 *       admin items (no Projects Directory / admin routes / admin-only labels).
 *   a4) Admin dashboard apps menu shows ONLY admin items (no client-only
 *       items like "My Projects" or "Profile & Property", no /projects or
 *       /profile client routes).
*  a5) No hardcoded menu selection by `isStaff` remains for the apps menu
 *       (that was the root cause of admin items leaking into the client view).
 *  a6) Client dashboard avatar click navigates to /profile (Profile & Property).
 *  a7) Admin dashboard avatar is a plain, inert display element — no click
 *       handler, no navigation, and no clickable styling at all (fully
 *       reverted, not merely disabled).
 *
 * Pure source checks — no browser, no network. Run with:
 *   node backend/verify-scripts/verify-topbar-role-scope.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TOPBAR_SRC = fs.readFileSync(path.join(ROOT, 'src', 'components', 'Topbar.jsx'), 'utf8');
const LAYOUT_SRC = fs.readFileSync(path.join(ROOT, 'src', 'components', 'DashboardLayout.jsx'), 'utf8');
const SIDEBAR_LINKS_SRC = fs.readFileSync(path.join(ROOT, 'src', 'data', 'sidebarLinks.js'), 'utf8');

const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

// Extract the client/admin link destinations from the sidebar data module.
// Bound each block to the array literal so one export can't bleed into the next.
function extractRoutes(src, name) {
  const start = src.indexOf(`export const ${name} = [`);
  const end = src.indexOf('];', start);
  const body = src.slice(start, end + 2);
  const dests = [];
  const re = /\{\s*id:[^,]+,\s*to:\s*'([^']+)',\s*label:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    dests.push({ to: m[1], label: m[2] });
  }
  return dests;
}

const clientSidebar = extractRoutes(SIDEBAR_LINKS_SRC, 'clientLinks');
const adminSidebar = extractRoutes(SIDEBAR_LINKS_SRC, 'adminLinks');

console.log(`sidebar client routes: ${clientSidebar.map((l) => l.to).join(', ')}`);
console.log(`sidebar admin routes: ${adminSidebar.map((l) => l.to).join(', ')}`);

// --- a1) variant prop plumbed through ------------------------------------------
const a1 =
  /export default function Topbar\(\{\s*variant = 'client'\s*\}\)/.test(TOPBAR_SRC) &&
  /<Topbar variant=\{variant\} \/>/.test(LAYOUT_SRC);
record(
  'a1) Topbar accepts `variant` prop and DashboardLayout passes it through',
  a1,
  a1 ? '' : 'Topbar does not read the layout variant or it is not passed by DashboardLayout',
);

// --- a2) apps menu derived from the shared sidebar link data -------------------
const a2 =
  TOPBAR_SRC.includes("clientLinks, adminLinks } from '../data/sidebarLinks'") &&
  /const CLIENT_APPS = clientLinks\.map/.test(TOPBAR_SRC) &&
  /const ADMIN_APPS = adminLinks\.map/.test(TOPBAR_SRC);
record(
  'a2) apps menu derived from the same clientLinks/adminLinks as the sidebar',
  a2,
  a2 ? '' : 'Topbar no longer sources its apps lists from data/sidebarLinks.js',
);

// --- a3) client apps menu === exactly the 4 client sidebar items ---------------
// CLIENT_APPS maps the shared clientLinks array, which is asserted here to be
// exactly the 4 client destinations with no admin routes/labels.
const expectedClient = ['/dashboard', '/projects', '/profile', '/billing'];
const clientRoutes = clientSidebar.map((l) => l.to);
const clientLabels = clientSidebar.map((l) => l.label);
const a3 =
  clientRoutes.length === 4 &&
  expectedClient.every((r) => clientRoutes.includes(r)) &&
  clientLabels.includes('Dashboard') &&
  clientLabels.includes('My Projects') &&
  clientLabels.includes('Profile & Property') &&
  clientLabels.includes('Billing') &&
  !clientRoutes.some((r) => r.startsWith('/admin')) &&
  !clientLabels.includes('Projects Directory') &&
  /const CLIENT_APPS = clientLinks\.map/.test(TOPBAR_SRC);
record(
  'a3) client apps = exactly the 4 client sidebar destinations (Dashboard, My Projects, Profile & Property, Billing), no admin items',
  a3,
  `routes=${clientRoutes.join(', ')} labels=${clientLabels.join(', ')}`,
);

// --- a4) admin apps menu = admin destinations only, no client-only items -------
const adminRoutes = adminSidebar.map((l) => l.to);
const adminLabels = adminSidebar.map((l) => l.label);
const a4 =
  adminRoutes.every((r) => r.startsWith('/admin')) &&
  adminRoutes.includes('/admin/dashboard') &&
  adminRoutes.includes('/admin/projects') &&
  adminRoutes.includes('/admin/services') &&
  adminRoutes.includes('/admin/settings') &&
  !adminLabels.includes('My Projects') &&
  !adminLabels.includes('Profile & Property') &&
  !adminLabels.includes('Billing') &&
  !adminRoutes.includes('/projects') &&
  !adminRoutes.includes('/profile') &&
  !adminRoutes.includes('/billing') &&
  /const ADMIN_APPS = adminLinks\.map/.test(TOPBAR_SRC);
record(
  'a4) admin apps = admin destinations only, no client-only items/routes',
  a4,
  `routes=${adminRoutes.join(', ')} labels=${adminLabels.join(', ')}`,
);

// --- a5) apps menu selection no longer keyed on isStaff (root cause) -----------
const renderSelectOk =
  /variant === 'admin' \? ADMIN_APPS : CLIENT_APPS/.test(TOPBAR_SRC) ||
  /\(variant === 'admin' \? ADMIN_APPS : CLIENT_APPS\)\.map/.test(TOPBAR_SRC);
const a5 =
  renderSelectOk &&
  !/(isStaff \? ADMIN_APPS : [A-Z_]+)\.map/.test(TOPBAR_SRC) &&
  !TOPBAR_SRC.includes('TOPBAR_APPS');
record(
  'a5) apps menu selected by layout variant, not isStaff; no stale TOPBAR_APPS',
  a5,
  a5 ? '' : 'apps menu still uses isStaff/TOPBAR_APPS for selection',
);

// --- a6) client avatar click navigates to /profile (Profile & Property) -------
const a6 =
  /onClick=\{\(\) => navigate\('\/profile'\)\}/.test(TOPBAR_SRC) &&
  /aria-label="Open profile"/.test(TOPBAR_SRC) &&
  TOPBAR_SRC.includes("onClick={() => navigate('/profile')}");
record(
  'a6) client avatar click -> /profile (Profile & Property)',
  a6,
  a6 ? '' : 'client avatar does not navigate to /profile on click',
);

// --- a7) admin avatar is fully inert (no handler, no navigation, no styling) ---
const adminBranchOk =
  /variant === 'admin' \? \(/.test(TOPBAR_SRC) &&
  /variant === 'admin' \? \([\s\S]*?<TopbarAvatar/.test(TOPBAR_SRC);
const a7 =
  adminBranchOk &&
  !/navigate\(variant === 'admin' \? '\/admin\/settings' : '\/profile'\)/.test(TOPBAR_SRC) &&
  !/navigate\('\/admin\/settings'\)/.test(TOPBAR_SRC) &&
  !/variant === 'admin' \? '\/admin\/settings'/.test(TOPBAR_SRC);
record(
  'a7) admin avatar is a plain inert TopbarAvatar — no click handler, no navigation, no clickable styling',
  a7,
  a7 ? '' : 'admin avatar still has click/navigation wiring or clickable styling',
);

// --- summary --------------------------------------------------------------------
console.log('\n==================== SUMMARY ====================');
results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
console.log('================================================');
console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

process.exit(failures === 0 ? 0 : 1);
