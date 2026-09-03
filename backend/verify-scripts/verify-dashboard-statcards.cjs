/**
 * Client dashboard stat-card redesign verification.
 *
 * The 4 stat cards now match Figma: white card background (#FFFFFF), the
 * number coloured var(--eco, #12B14E), each icon inside a coloured chip that
 * carries the Figma box-shadow (0px 4px 4.8px 0px #0B1C3040), plus a more
 * compact card padding and tighter gap between the 4 cards.
 *
 * Data flow must be untouched (stat cards still read from clientStats) and the
 * admin panel's compact StatCard variant must be unaffected.
 *
 * Pure source checks — no credentials required.
 * Usage: node backend/verify-scripts/verify-dashboard-statcards.cjs
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
  console.log('\n--- Stat-card redesign ---');

  const statCard = readSrc('components/StatCard.jsx');
  const dash = readSrc('pages/client/ClientDashboard.jsx');

  // a1) white card background
  const a1 = statCard.includes('bg-white rounded-xl');
  record(
    'a1) card background is white (#FFFFFF)',
    a1,
    a1 ? '' : 'card background class changed',
  );

  // a2) number colour is the Figma eco green (var(--eco, #12B14E))
  const a2 =
    statCard.includes("'text-[#12B14E]'") &&
    !statCard.includes('text-[#10B981]');
  record(
    'a2) number colour is var(--eco, #12B14E) (old #10B981 gone)',
    a2,
    a2 ? '' : 'number colour did not change to #12B14E',
  );

  // a3) icon chip carries the Figma box-shadow (0B1C3040)
  const a3 = statCard.includes(
    'shadow-[0px_4px_4.8px_0px_rgba(11,28,48,0.25)]',
  ) && statCard.includes('bg-[rgba(11,28,48,0.11)]');
  record(
    'a3) icon chip has coloured bg + Figma box-shadow (0px 4px 4.8px 0px #0B1C3040)',
    a3,
    a3 ? '' : 'icon chip background or shadow is missing',
  );

  // a4) compact card padding (p-2.5 sm:p-3) — no larger padding remains
  const a4 = statCard.includes('rounded-xl p-2.5 sm:p-3');
  record(
    'a4) card padding reduced to compact Figma size (p-2.5 sm:p-3)',
    a4,
    a4 ? '' : 'card padding was not reduced',
  );

  // a5) tighter gap between the 4 cards (gap-3 sm:gap-4)
  const a5 =
    dash.includes('gap-3 sm:gap-4') &&
    !dash.includes('sm:gap-5');
  record(
    'a5) stat grid gap tightened (gap-3 sm:gap-4)',
    a5,
    a5 ? '' : 'stat grid gap was not tightened',
  );

  // a6) data flow untouched: cards still render from clientStats
  const a6 =
    dash.includes('clientStats.map') &&
    dash.includes('<StatCard key={i} icon={s.icon} value={s.value} label={s.label}');
  record(
    'a6) data flow intact (cards render live clientStats values)',
    a6,
    a6 ? '' : 'stat cards no longer read from clientStats',
  );

  // a7) admin compact variant untouched (no regression on admin panel)
  const a7 =
    statCard.includes('admin-stat-card') &&
    statCard.includes('admin-stat-icon') &&
    statCard.includes('compact = false');
  record(
    'a7) admin compact StatCard variant unaffected',
    a7,
    a7 ? '' : 'admin stat-card markup was altered',
  );

  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

  process.exit(failures === 0 ? 0 : 1);
}

main();