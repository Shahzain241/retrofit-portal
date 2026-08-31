/**
 * One-time Supabase provisioning for the epc-certificates Storage bucket.
 *
 * EPC certificates are sensitive documents, so this bucket is PRIVATE (unlike
 * the public `avatars` bucket):
 *   1) a private Storage bucket named `epc-certificates` (5MB per-file cap,
 *      PDF/JPG/PNG only — EPC certs are commonly scanned as either)
 *   2) storage.objects RLS policies so only the OWNING client can
 *      insert/update/delete their own file (path must start with their own
 *      auth.uid()), and read is restricted to the owner, staff and
 *      super-admins (reusing public.is_staff() / public.is_super_admin())
 *   3) the `profiles.epc_certificate_path` text column used by Profile.jsx to
 *      store the uploaded certificate's storage path (NOT a URL — the bucket
 *      is private, so the UI generates short-lived signed URLs on demand)
 *
 * Uses the Supabase Management API, so it requires SUPABASE_MANAGEMENT_TOKEN
 * (a personal access token starting with `sbp_`, see .env.example). It does
 * NOT use the anon key — the anon key cannot create buckets/policies.
 *
 * Usage: SUPABASE_MANAGEMENT_TOKEN=sbp_... node scripts/setup-epc-bucket.cjs
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

async function managementApi(path, method, body) {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${REF}${path}`, {
    method,
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    throw new Error(`${method} ${path} failed (${resp.status}): ${await resp.text()}`);
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
  console.log('--- epc-certificates bucket provisioning ---');

  // 1) create the PRIVATE bucket if it does not exist
  //    The Management API only exposes list/update for storage buckets — there
  //    is no create-bucket endpoint (POST /storage/buckets returns 404). Buckets
  //    are created via SQL instead (storage.buckets row insert).
  const buckets = await managementApi('/storage/buckets', 'GET');
  const exists = Array.isArray(buckets) && buckets.some((b) => b.id === 'epc-certificates');
  if (!exists) {
    await runQuery(
      `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
       values ('epc-certificates', 'epc-certificates', false, 5242880,
               array['application/pdf', 'image/jpeg', 'image/png']);`,
    );
    console.log('created bucket: epc-certificates (private, 5MB, PDF/JPG/PNG only)');
  } else {
    console.log('bucket epc-certificates already exists — skipping creation');
  }

  // 2) policies + column (idempotent via drop-if-exists / add-if-not-exists)
  const sql = `
    -- read: owner, staff or super-admin only (NOT public)
    drop policy if exists "epc_certificates_read" on storage.objects;
    create policy "epc_certificates_read" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'epc-certificates'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or public.is_staff()
          or public.is_super_admin()
        )
      );

    -- write: only the owning client can insert into their own uid-prefixed folder
    drop policy if exists "epc_certificates_own_insert" on storage.objects;
    create policy "epc_certificates_own_insert" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'epc-certificates' and (storage.foldername(name))[1] = auth.uid()::text);

    -- ... and update/upsert only their own file
    drop policy if exists "epc_certificates_own_update" on storage.objects;
    create policy "epc_certificates_own_update" on storage.objects
      for update to authenticated
      using (bucket_id = 'epc-certificates' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'epc-certificates' and (storage.foldername(name))[1] = auth.uid()::text);

    -- ... and delete only their own file
    drop policy if exists "epc_certificates_own_delete" on storage.objects;
    create policy "epc_certificates_own_delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'epc-certificates' and (storage.foldername(name))[1] = auth.uid()::text);

    -- storage path column used by Profile.jsx (path, NOT a public URL)
    alter table public.profiles add column if not exists epc_certificate_path text;
  `;
  await runQuery(sql);
  console.log('applied storage policies + profiles.epc_certificate_path column');

  console.log('\ndone. bucket `epc-certificates` is ready for Profile.jsx EPC uploads.');
}

main().catch((e) => {
  console.error('\nSETUP SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});