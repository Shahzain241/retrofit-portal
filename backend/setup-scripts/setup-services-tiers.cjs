/**
 * One-time Supabase provisioning for ServiceForm real features:
 *  1) service pricing tiers + per-tier deliverables tables and the
 *     services.media_url column (applies backend/sql/17_services_tiers.sql)
 *  2) a PUBLIC Storage bucket named `service-media` (10MB per-file cap,
 *     PDF/JPEG/PNG — matches the ServiceForm Media dropzone copy), readable
 *     by anyone but writeable only by super-admins (same RLS philosophy as
 *     the `services` table, unlike the client-owned avatars/docs buckets).
 *
 * The media bucket is PUBLIC because service images are shown to the public
 * catalogue; the public URL is stored directly in services.media_url (no
 * signed URLs needed), mirroring the `avatars` pattern.
 *
 * Uses the Supabase Management API, so it requires SUPABASE_MANAGEMENT_TOKEN
 * (a personal access token starting with `sbp_`, see backend/.env.example).
 *
 * Usage: SUPABASE_MANAGEMENT_TOKEN=sbp_... node backend/setup-scripts/setup-services-tiers.cjs
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
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

async function managementApi(pathname, method, body) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${REF}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    throw new Error(`${method} ${pathname} failed (${resp.status}): ${await resp.text()}`);
  }
  return resp.json();
}

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
  console.log('--- ServiceForm real-features provisioning ---');

  // 1) apply the schema migration (idempotent)
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'sql', '17_services_tiers.sql'),
    'utf8',
  );
  await runQuery(migration);
  console.log('applied backend/sql/17_services_tiers.sql (tiers + deliverables + media_url)');

  // 2) create the PUBLIC service-media bucket if it does not exist
  const buckets = await managementApi('/storage/buckets', 'GET');
  const exists = Array.isArray(buckets) && buckets.some((b) => b.id === 'service-media');
  if (!exists) {
    await runQuery(
      `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
       values ('service-media', 'service-media', true, 10485760,
               array['application/pdf', 'image/jpeg', 'image/png']);`,
    );
    console.log('created bucket: service-media (public, 10MB, PDF/JPEG/PNG only)');
  } else {
    console.log('bucket service-media already exists — skipping creation');
  }

  // 3) storage.objects policies: public read; only super-admins can
  //    insert/update/delete (mirrors the services table ownership model)
  const sql = `
    -- anyone can read the public service-media bucket
    drop policy if exists "service_media_public_read" on storage.objects;
    create policy "service_media_public_read" on storage.objects
      for select using (bucket_id = 'service-media');

    -- only super-admins can upload service media
    drop policy if exists "service_media_super_admin_insert" on storage.objects;
    create policy "service_media_super_admin_insert" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'service-media' and public.is_super_admin());

    -- ... and update/upsert only by super-admins
    drop policy if exists "service_media_super_admin_update" on storage.objects;
    create policy "service_media_super_admin_update" on storage.objects
      for update to authenticated
      using (bucket_id = 'service-media' and public.is_super_admin())
      with check (bucket_id = 'service-media' and public.is_super_admin());

    -- ... and delete only by super-admins
    drop policy if exists "service_media_super_admin_delete" on storage.objects;
    create policy "service_media_super_admin_delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'service-media' and public.is_super_admin());
  `;
  await runQuery(sql);
  console.log('applied storage.objects policies for service-media (public read, super-admin write)');

  console.log('\ndone. ServiceForm tiers/deliverables/media are ready.');
}

main().catch((e) => {
  console.error('\nSETUP SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});