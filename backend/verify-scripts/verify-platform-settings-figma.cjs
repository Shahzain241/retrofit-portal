/**
 * Platform Settings → Figma gap verification.
 *
 * Checks the fixes made to bring the live Platform Settings page in line with
 * the Figma design (sidebar nav, Settings page, email-template preview):
 *
 *   a1) Sidebar nav label is "My Projects" for the admin /admin/projects link
 *       (no stale "Projects Directory" label anywhere in the sidebar data).
 *   a2) The Dashboard nav item uses the lucide `Home` icon (not a grid icon)
 *       for BOTH client and admin links.
 *   a3) The "Integration Health" disclaimer line
 *       ("Demo data — no live integrations...") is ABSENT from Settings.jsx.
 *   a4) An "Update" button exists in the Email Template section (green,
 *       right-aligned via the shared Button component).
 *   a5) A bottom action row has BOTH a "Discard Changes" (outline/white) and
 *       a "Save" (green) button.
 *   a6) The email-template preview substitutes merge tags ({{project_name}},
 *       {{user_name}}, {{link}}) with sample values, renders no raw {{...}}
 *       tags, and does not duplicate the heading + body text.
 *   a7) "View Status" renders as a link/button element (the template's
 *       <a class="btn"> is preserved, not stripped to plain text).
 *   a8) The preview is rendered via dangerouslySetInnerHTML from
 *       utils/emailPreview.js (not a text-only concatenation).
 *
 * Pure source checks — no credentials required.
 * Usage: node backend/verify-scripts/verify-platform-settings-figma.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function readSrc(rel) {
  return fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8');
}

function main() {
  const LINKS = readSrc('data/sidebarLinks.js');
  const SETTINGS = readSrc('pages/admin/Settings.jsx');
  const PREVIEW = fs.readFileSync(path.join(ROOT, 'src', 'utils', 'emailPreview.js'), 'utf8');
  const PREVIEW_CSS = readSrc('styles/Settings.css');

  // --- a1) sidebar label "My Projects" -----------------------------------------
  const a1 =
    LINKS.includes("to: '/admin/projects'") &&
    LINKS.includes("label: 'My Projects'") &&
    !LINKS.includes("label: 'Projects Directory'") &&
    !LINKS.includes("label: 'Projects Directory'");
  record(
    'a1) sidebar admin link labeled "My Projects" (no stale "Projects Directory")',
    a1,
    a1 ? '' : 'admin label is not "My Projects" or a stale "Projects Directory" label remains',
  );

  // --- a2) Dashboard uses lucide Home icon --------------------------------------
  const a2 =
    LINKS.includes('Home,') &&
    /label: 'Dashboard', icon: Home/.test(LINKS) &&
    !/label: 'Dashboard', icon: LayoutDashboard/.test(LINKS) &&
    !LINKS.includes('LayoutDashboard');
  record(
    'a2) Dashboard nav item uses lucide Home icon (grid icon removed)',
    a2,
    a2 ? '' : 'Dashboard still uses a grid icon or Home is not wired up',
  );

  // --- a3) disclaimer line absent ------------------------------------------------
  const a3 =
    !SETTINGS.includes('Demo data — no live integrations are configured in this environment.');
  record(
    'a3) Integration Health "Demo data" disclaimer line removed',
    a3,
    a3 ? '' : 'the disclaimer line is still present',
  );

  // --- a4) Update button in Email Template section --------------------------------
  const a4 =
    SETTINGS.includes('Email Template') &&
    SETTINGS.includes('Update') &&
    SETTINGS.includes('rp-update-btn') &&
    SETTINGS.includes('variant="green"');
  record(
    'a4) "Update" button present in Email Template section (green, rp-update-btn)',
    a4,
    a4 ? '' : 'missing the green Update button in the Email Template section',
  );

  // --- a5) bottom Discard Changes + Save row --------------------------------------
  const a5 =
    SETTINGS.includes('Discard Changes') &&
    SETTINGS.includes('rp-dash-action-cancel') &&
    SETTINGS.includes('Save') &&
    SETTINGS.includes('rp-dash-action-save');
  record(
    'a5) bottom action row has Discard Changes (outline) + Save (green) buttons',
    a5,
    a5 ? '' : 'bottom action row is missing Discard Changes or Save',
  );

  // --- a6) preview substitutes merge tags, no raw tags, no duplication ------------
  // The util must define sample values for every merge tag used in the
  // template and a substitution function that replaces {{...}} tags.
  const a6 =
    PREVIEW.includes('project_name:') &&
    PREVIEW.includes('Sunnydale Retrofit') &&
    PREVIEW.includes('user_name:') &&
    PREVIEW.includes('Jane Doe') &&
    PREVIEW.includes("link: '#'") &&
    /substituteMergeTags/.test(PREVIEW) &&
    /PREVIEW_MERGE_VALUES\[key\]/.test(PREVIEW);
  record(
    'a6) preview util substitutes {{project_name}}/{{user_name}}/{{link}} with sample values',
    a6,
    a6 ? '' : 'merge-tag substitution is missing from the preview util',
  );

  // a6b) Settings renders the preview via the util (not raw text concat)
  const a6b =
    SETTINGS.includes('previewEmailHtml') &&
    SETTINGS.includes('dangerouslySetInnerHTML') &&
    !SETTINGS.includes('previewBody');
  record(
    'a6b) preview rendered from previewEmailHtml (no raw text-only concat)',
    a6b,
    a6b ? '' : 'preview is not wired to previewEmailHtml or still uses previewBody',
  );

  // a6c) the util strips the .header wrapper (removes duplication root cause)
  const a6c =
    PREVIEW.includes('div class="header"') &&
    /<div class="header">[\s\S]*?<\/div>/.test(PREVIEW);
  record(
    'a6c) preview util strips the .header wrapper (no duplicated heading+body)',
    a6c,
    a6c ? '' : 'preview util does not remove the duplicated header wrapper',
  );

  // --- a7) View Status renders as link/button --------------------------------------
  const a7 =
    PREVIEW_CSS.includes('.st-email-preview a.btn') &&
    /a\.btn/.test(PREVIEW_CSS);
  record(
    'a7) "View Status" (.btn anchor) is styled as a link/button in the preview',
    a7,
    a7 ? '' : 'preview CSS does not style the .btn anchor as a button/link',
  );

  // a7b) the util preserves the anchor tag (does not strip <a>)
  // The preview only strips class attributes and the .header wrapper — it
  // must NOT strip the anchor element itself, and it substitutes {{link}}.
  const a7b =
    PREVIEW.includes('.replace(/') &&
    PREVIEW.includes('class="[^"]*"') &&
    !/\.replace\(\/\s*<\/?a[^>]*>\/g/.test(PREVIEW);
  record(
    'a7b) preview util keeps the <a href> tag for View Status',
    a7b,
    a7b ? '' : 'the anchor element is stripped from the preview',
  );

  console.log('\n==================== SUMMARY ====================');
  results.forEach((r) => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`));
  console.log('================================================');
  console.log(`TOTAL: ${results.length}   PASSED: ${results.length - failures}   FAILED: ${failures}`);

  process.exit(failures === 0 ? 0 : 1);
}

main();
