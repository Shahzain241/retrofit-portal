/**
 * One-time Supabase provisioning for the project-documents Storage bucket.
 *
 * Project documents (Task & Docs tab) are private files, so this bucket is
 * PRIVATE (same as epc-certificates, unlike the public `avatars` bucket):
 *   1) a private Storage bucket named `project-documents` (10MB per-file cap,
 *      PDF/DOC/DOCX/JPG/PNG only — common retrofit document types)
 *   2) storage.objects RLS policies so only the OWNING CLIENT can insert into
 *      their own project's folder (folder prefix = project_id, and that project
 *      must be owned by auth.uid()), while read is allowed for the owning
 *      client, staff and super-admins (reusing public.is_client() /
 *      public.is_staff() / public.is_super_admin())
 *   3) rows are recorded in public.project_documents (see
 *      backend/sql/12_project_documents_table.sql) storing the Storage PATH
 *      (NOT a URL — the bucket is private, so the UI generates short-lived
 *      signed URLs on demand, same as Profile.jsx EPC certificates)
 *
 * Uses the Supabase Management API, so it requires SUPABASE_MANAGEMENT_TOKEN
 * (a personal access token starting with `sbp_`, see backend/.env.example).
 *
 * Usage: SUPABASE_MANAGEMENT_TOKEN=sbp_... node backend/setup-scripts/setup-project-documents-bucket.cjs
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
  console.log('--- project-documents bucket provisioning ---');

  // 1) create the PRIVATE bucket if it does not exist (SQL insert — the
  //    Management API has no create-bucket endpoint)
  const buckets = await managementApi('/storage/buckets', 'GET');
  const exists = Array.isArray(buckets) && buckets.some((b) => b.id === 'project-documents');
  if (!exists) {
    await runQuery(
      `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
       values ('project-documents', 'project-documents', false, 10485760,
               array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']);`,
    );
    console.log('created bucket: project-documents (private, 10MB, PDF/DOC/DOCX/JPG/PNG only)');
  } else {
    console.log('bucket project-documents already exists — skipping creation');
  }

  // 2) storage.objects policies (idempotent via drop-if-exists)
  const sql = `
    -- read: owning client (project owner), staff or super-admin only (NOT public)
    drop policy if exists "project_documents_read" on storage.objects;
    create policy "project_documents_read" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'project-documents'
        and (
          (storage.foldername(name))[1] in (select id from public.projects where client_id = auth.uid())
          or public.is_staff()
          or public.is_super_admin()
        )
      );

    -- write: only the owning client can insert into their own project's folder
    drop policy if exists "project_documents_own_insert" on storage.objects;
    create policy "project_documents_own_insert" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'project-documents'
        and public.is_client()
        and (storage.foldername(name))[1] in (select id from public.projects where client_id = auth.uid())
      );

    -- ... and update/upsert only files in their own project's folder
    drop policy if exists "project_documents_own_update" on storage.objects;
    create policy "project_documents_own_update" on storage.objects
      for update to authenticated
      using (
        bucket_id = 'project-documents'
        and (storage.foldername(name))[1] in (select id from public.projects where client_id = auth.uid())
      )
      with check (
        bucket_id = 'project-documents'
        and (storage.foldername(name))[1] in (select id from public.projects where client_id = auth.uid())
      );

    -- ... and delete only files in their own project's folder (plus super-admin,
    -- so verify scripts / admins can clean up test uploads)
    drop policy if exists "project_documents_own_delete" on storage.objects;
    create policy "project_documents_own_delete" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'project-documents'
        and (
          (storage.foldername(name))[1] in (select id from public.projects where client_id = auth.uid())
          or public.is_super_admin()
        )
      );
  `;
  await runQuery(sql);
  console.log('applied storage.objects policies for project-documents');

  console.log('\ndone. bucket `project-documents` is ready for TaskDocsTab uploads.');
}

main().catch((e) => {
  console.error('\nSETUP SCRIPT ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});