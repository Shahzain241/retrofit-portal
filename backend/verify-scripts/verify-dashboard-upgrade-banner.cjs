/**
 * Client dashboard "Upgrade to Priority Support" banner verification.
 *
 * The banner sits directly below the "Your Active Projects" section. It
 * reuses the existing billing flow — the "Upgrade Now" button is a plain
 * Link to /billing/plans (no new payment flow). The price is read from the
 * real Priority tier in src/data/plans.js; the Figma copy said "£39/mo" but
 * the catalog says £29/mo, so the banner must NOT hardcode a fake £39 — the
 * mismatch is flagged here instead.
 *
 *   a1) banner component exists and is rendered below the active-projects
 *       section in ClientDashboard (after the project grid / empty state)
 *   a2) heading "Upgrade to Priority Support" present
 *   a3) subtext present and the price comes from the plans catalog (the
 *       Priority tier), not a hardcoded fake number
 *   a4) "Upgrade Now" green button present
 *   a5) button navigates via Link to /billing/plans (existing flow) and that
 *       route exists in App.jsx
 *   a6) banner is rendered unconditionally (no plan gate can hide it)
 *   a7) content mismatch flagged: plans.js Priority price is £29, and the
 *       banner shows the catalog price — it never hardcodes Figma's £39
 *
 * Pure source checks — no credentials required.
 * Usage: node backend/verify-scripts/verify-dashboard-upgrade-banner.cjs
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
  console.log('\n--- Upgrade to Priority Support banner ---');

  const dash = readSrc('pages/client/ClientDashboard.jsx');
  const banner = readSrc('components/UpgradeBanner.jsx');
  const plans = readSrc('data/plans.js');
  const app = readSrc('App.jsx');

  // a1) rendered below the active-projects section
  const a1 =
    dash.includes('<UpgradeBanner />') &&
    dash.indexOf('<UpgradeBanner />') > dash.lastIndexOf('Your Active Projects') &&
    dash.indexOf('<UpgradeBanner />') > dash.indexOf('empty-state');
  record(
    'a1) banner rendered below the "Your Active Projects" section',
    a1,
    a1 ? '' : 'banner is missing or not positioned after the projects section',
  );

  // a2) heading
  const a2 = banner.includes('Upgrade to Priority Support');
  record(
    'a2) heading "Upgrade to Priority Support" present',
    a2,
    a2 ? '' : 'heading text is wrong or missing',
  );

  // a3) subtext price derived from the plans catalog (Priority tier)
  const a3 =
    banner.includes("import { plans } from '../data/plans'") &&
    banner.includes("p.id === 'plan-priority'") &&
    banner.includes('Get Priority Support for {price}/mo — faster responses + 15% off');
  record(
    'a3) subtext present with price derived from the plans catalog (Priority tier)',
    a3,
    a3 ? '' : 'price is not sourced from the plans catalog',
  );

  // a4) green "Upgrade Now" button
  const a4 =
    banner.includes('Upgrade Now') &&
    banner.includes('variant="green"') &&
    banner.includes('rp-upgrade-btn');
  record(
    'a4) green "Upgrade Now" button present',
    a4,
    a4 ? '' : 'button label/variant is wrong or missing',
  );

  // a5) navigates to /billing/plans (existing flow), route exists
  const a5 =
    banner.includes('<Link to="/billing/plans"') &&
    app.includes('path="/billing/plans"');
  record(
    'a5) button is a Link to /billing/plans (existing route, no new payment flow)',
    a5,
    a5 ? '' : 'navigation target or route is missing',
  );

  // a6) rendered unconditionally (no plan gate)
  const a6 =
    dash.includes('<UpgradeBanner />') &&
    !dash.includes("profile.plan?.toLowerCase() !== 'priority'");
  record(
    'a6) banner rendered unconditionally (no plan gate can hide it)',
    a6,
    a6 ? '' : 'banner is still gated behind the Priority plan check',
  );

  // a7) price mismatch flagged: catalog says £29; banner never hardcodes £39
  //     (comments are stripped first — the mismatch note itself mentions £39)
  const bannerNoComments = banner.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const a7 =
    /id: 'plan-priority'[\s\S]*?price: '£29'/.test(plans) &&
    !bannerNoComments.includes('£39');
  record(
    'a7) no fake price: banner shows catalog £29 (Figma £39 mismatch flagged, not hardcoded)',
    a7,
    a7 ? '' : 'banner hardcodes a price that does not match the catalog',
  );

  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

  process.exit(failures === 0 ? 0 : 1);
}

main();