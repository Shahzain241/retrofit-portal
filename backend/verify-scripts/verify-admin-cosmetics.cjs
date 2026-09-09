/**
 * Admin cosmetics verification (InviteStaff role options + Sidebar label).
 *
 *   a1) InviteStaff role select no longer contains the bogus "John Smith"
 *       option (it mapped to no real role and always errored); it now only
 *       offers the three real invitable roles (Coordinator/Designer/Assessor).
 *   a2) the admin Sidebar link to /admin/projects is labeled "My Projects"
 *       (matching Figma); the route is unchanged.
 *
 * Pure source checks — no credentials required.
 * Usage: node backend/verify-scripts/verify-admin-cosmetics.cjs
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
  const LINKS_SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'data', 'sidebarLinks.js'),
    'utf8',
  );

  console.log('\n--- InviteStaff role select ---');
  const a1 =
    !INVITE_SRC.includes('<option>John Smith</option>') &&
    INVITE_SRC.includes('<option>Coordinator</option>') &&
    INVITE_SRC.includes('<option>Designer</option>') &&
    INVITE_SRC.includes('<option>Assessor</option>');
  record(
    'a1) InviteStaff role select has no bogus "John Smith" option (only real roles)',
    a1,
    a1 ? '' : 'the bogus option is still present or a real role option is missing',
  );

  console.log('\n--- Sidebar admin label ---');
  const a2 =
    LINKS_SRC.includes("to: '/admin/projects'") &&
    LINKS_SRC.includes("label: 'My Projects'") &&
    !LINKS_SRC.includes("to: '/admin/projects', label: 'Projects Directory'") &&
    LINKS_SRC.includes("to: '/projects', label: 'My Projects'");
  record(
    'a2) admin link labeled "My Projects" (route unchanged; no stale "Projects Directory" label)',
    a2,
    a2 ? '' : 'admin label is not "My Projects" or a stale label remains',
  );

  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

  process.exit(failures === 0 ? 0 : 1);
}

main();