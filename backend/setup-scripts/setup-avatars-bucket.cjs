/**
 * One-time Supabase provisioning for the avatars Storage bucket.
 *
 * Creates (idempotently — safe to re-run):
 *   1) a public Storage bucket named `avatars` (2MB per-file cap, image
 *      mime types only) — first Storage bucket in this project
 *   2) storage.objects RLS policies so anyone can read, but only a signed-in
 *      user can insert/update/delete their OWN file (path must start with
 *      their own auth.uid())
 *   3) the `profiles.avatar_url` text column used by Profile.jsx to store the
 *      uploaded avatar's public URL
 *
 * Uses the Supabase Management API, so it requires SUPABASE_MANAGEMENT_TOKEN
 * (a personal access token starting with `sbp_`, see backend/.env.example). It does
 * NOT use the anon key — the anon key cannot create buckets/policies.
 *
 * Usage: SUPABASE_MANAGEMENT_TOKEN=sbp_... node backend/setup-scripts/setup-avatars-bucket.cjs
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
  console.log('--- avatars bucket provisioning ---');

  // 1) create the public bucket if it does not exist
  //    The Management API only exposes list/update for storage buckets — there
  //    is no create-bucket endpoint (POST /storage/buckets returns 404). Buckets
  //    are created via SQL instead (storage.buckets row insert).
  const buckets = await managementApi('/storage/buckets', 'GET');
  const exists = Array.isArray(buckets) && buckets.some((b) => b.id === 'avatars');
  if (!exists) {
    await runQuery(
      `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
       values ('avatars', 'avatars', true, 2097152,
               array['image/png', 'image/jpeg', 'image/webp', 'image/gif']);`,
    );
    console.log('created bucket: avatars (public, 2MB, images only)');
  } else {
    console.log('bucket avatars already exists — skipping creation');
  }

  // 2) policies + column (idempotent via drop-if-exists / add-if-not-exists)
  const sql = `
    -- anyone can read the public avatars bucket
    drop policy if exists "avatars_public_read" on storage.objects;
    create policy "avatars_public_read" on storage.objects
      for select using (bucket_id = 'avatars');

    -- a signed-in user can insert only into their own uid-prefixed folder
    drop policy if exists "avatars_own_insert" on storage.objects;
    create policy "avatars_own_insert" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

    -- ... and update/upsert only their own file
    drop policy if exists "avatars_own_update" on storage.objects;
    create policy "avatars_own_update" on storage.objects
      for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

    -- ... and delete only their own file
    drop policy if exists "avatars_own_delete" on storage.objects;
    create policy "avatars_own_delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

    -- avatar URL column used by Profile.jsx
    alter table public.profiles add column if not exists avatar_url text;
  `;
  await runQuery(sql);
  console.log('applied storage policies + profiles.avatar_url column');

  console.log('\ndone. bucket `avatars` is ready for Profile.jsx avatar uploads.');
}

main().catch((e) => {
  console.error('\nSETUP SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});