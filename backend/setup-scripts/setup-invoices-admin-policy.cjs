/**
 * One-time Supabase provisioning for the admin Revenue Trend chart.
 *
 * The admin dashboard's Revenue Trend chart needs to read ALL invoices to
 * aggregate monthly revenue, but the invoices table's only select policy is
 * owner-only (user_id = auth.uid()), so a super-admin currently sees zero
 * rows. This adds a "Super admins can select invoices" policy (idempotent —
 * safe to re-run) mirroring the existing super-admin select policies.
 *
 * Uses the Supabase Management API (SUPABASE_MANAGEMENT_TOKEN). The SQL is
 * also recorded in backend/sql/16_invoices_super_admin_policy.sql.
 *
 * Usage: SUPABASE_MANAGEMENT_TOKEN=sbp_... node backend/setup-scripts/setup-invoices-admin-policy.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const REF = 'xxtfqjbadzfjpcdfjdxo';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable ${name}. See backend/.env.example.`);
    process.exit(1);
  }
  return value;
}

const ADMIN_TOKEN = requireEnv('SUPABASE_MANAGEMENT_TOKEN');

async function runQuery(query) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw new Error(`management query failed (${resp.status}): ${await resp.text()}`);
  return resp.json();
}

async function main() {
  const sql = `
    drop policy if exists "Super admins can select invoices" on public.invoices;
    create policy "Super admins can select invoices" on public.invoices
      for select to authenticated
      using (public.is_super_admin());
  `;
  await runQuery(sql);
  console.log('added: "Super admins can select invoices" (idempotent)');
}

main().catch((e) => {
  console.error('\nSETUP SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});