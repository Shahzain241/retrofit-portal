/**
 * One-time Supabase provisioning for Billing's "Current Plan" card.
 *
 * Adds (idempotently — safe to re-run) two columns to `profiles`:
 *   1) `plan` (text, not null, default 'Free') — the user's subscription tier
 *   2) `next_billing_date` (date, nullable) — the next renewal date, null for
 *      the Free plan
 *
 * Uses the Supabase Management API, so it requires SUPABASE_MANAGEMENT_TOKEN
 * (a personal access token starting with `sbp_`, see .env.example). It does
 * NOT use the anon key — the anon key cannot alter schema.
 *
 * Usage: SUPABASE_MANAGEMENT_TOKEN=sbp_... node scripts/setup-billing.cjs
 */

const REF = 'xxtfqjbadzfjpcdfjdxo';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable ${name}. See .env.example.`);
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
  console.log('--- billing (Current Plan) provisioning ---');

  const sql = `
    -- subscription tier: text, defaults to the Free plan
    alter table public.profiles add column if not exists plan text not null default 'Free';

    -- next renewal date: null while on the Free plan
    alter table public.profiles add column if not exists next_billing_date date;
  `;
  await runQuery(sql);
  console.log('applied profiles.plan + profiles.next_billing_date columns');

  console.log('\ndone. Billing.jsx Current Plan card can now read plan/next_billing_date from profiles.');
}

main().catch((e) => {
  console.error('\nSETUP SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});