/**
 * Email-template preview rendering for the Platform Settings page.
 *
 * The stored email template is raw HTML containing merge tags (e.g.
 * {{project_name}}, {{user_name}}, {{link}}). For the PREVIEW ONLY we:
 *   1. Substitute each merge tag with a sample placeholder value.
 *   2. Remove the wrapping <div class="header"> so the heading is not
 *      duplicated alongside the body paragraph.
 *   3. Drop any tag-level styling classes so the preview renders as clean
 *      formatted text.
 *
 * The raw template string is never mutated — this function returns a fresh
 * string used purely for display.
 */

export const PREVIEW_MERGE_VALUES = {
  project_name: 'Sunnydale Retrofit',
  user_name: 'Jane Doe',
  link: '#',
};

/** Substitute every {{tag}} merge tag in `html` with its sample value. */
export function substituteMergeTags(html) {
  return String(html || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) =>
    key in PREVIEW_MERGE_VALUES ? PREVIEW_MERGE_VALUES[key] : match,
  );
}

/**
 * Build the clean preview HTML for a given raw template.
 *
 * Removes the `<div class="header">…</div>` wrapper (its heading text is
 * already covered by the body paragraph in the preview) and strips styling
 * classes/attributes from the remaining tags so the preview looks like a
 * plain rendered email rather than raw markup.
 */
export function previewEmailHtml(html) {
  let substituted = substituteMergeTags(html);

  // Drop the <div class="header"> wrapper so its heading is not duplicated
  // alongside the body paragraph in the preview.
  substituted = substituted.replace(/<div class="header">[\s\S]*?<\/div>/g, '');

  // Remove any "View Status" anchor (or any <a class="btn">) from the preview.
  // The Figma design does not include this element in the preview, so it is
  // stripped before rendering. The raw stored template is left untouched.
  substituted = substituted.replace(/<a\b[^>]*class="btn"[^>]*>[\s\S]*?<\/a>/g, '');

  // Strip every remaining class attribute for a clean preview.
  substituted = substituted.replace(/\s+class="[^"]*"/g, '');

  return substituted;
}

export default previewEmailHtml;
