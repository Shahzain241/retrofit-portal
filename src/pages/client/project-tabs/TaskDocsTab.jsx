import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Upload, FilePenLine, Download, X, Send, ExternalLink } from 'lucide-react';
import Button from '../../../components/Button';
import { useToast } from '../../../context/ToastContext';
import { supabase } from '../../../lib/supabaseClient';

// Private bucket + client-side upload guard (same shape as the avatar/EPC uploads).
const DOC_BUCKET = 'project-documents';
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];
const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10MB

/** Short human label for a stored mime type (shown in the docs list). */
function docTypeLabel(type) {
  if (type === 'application/pdf') return 'PDF';
  if (type === 'application/msword' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'Word';
  if (type === 'image/jpeg') return 'JPG';
  if (type === 'image/png') return 'PNG';
  return 'File';
}

/** Upload date for the docs list, e.g. "30 Aug 2026". */
function formatDocDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TaskDocsTab({ project }) {
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionText, setRevisionText] = useState('');
  const [feedback, setFeedback] = useState('');
  const fileInputRef = useRef(null);
  const { showToast } = useToast();

  const projectId = project?.id;

  // Real uploaded files from the project_documents table (RLS-scoped to the
  // owning client). The bucket is private, so viewing uses a signed URL.
  const fetchDocuments = useCallback(async () => {
    if (!projectId) {
      setDocsLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('project_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: true });
    if (error) {
      console.error('[TaskDocsTab] failed to load documents', error.message, error);
      setDocsError(true);
      setDocsLoading(false);
      return;
    }
    setDocuments((data ?? []).map((d) => ({
      id: d.id,
      name: d.file_name,
      meta: `${docTypeLabel(d.file_type)} • ${formatDocDate(d.uploaded_at)}`,
      filePath: d.file_path,
    })));
    setDocsLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    let mounted = true;

    const fetchTasks = async () => {
      if (!projectId) return;
      setTasksLoading(true);
      setTasksError(false);
      try {
        // Scoped by RLS ("Clients can view own project tasks") — a client only
        // ever sees tasks belonging to projects they own.
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId);
        if (error) throw new Error(error.message);

        const { data: staff, error: staffError } = await supabase
          .from('profiles')
          .select('id, full_name, email');
        if (staffError) throw new Error(staffError.message);

        const profileById = Object.fromEntries((staff ?? []).map((s) => [s.id, s]));
        if (mounted) {
          setTasks((data ?? []).map((t) => {
            const profile = t.assignee_id ? profileById[t.assignee_id] : null;
            return {
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              tags: t.tags ?? [],
              dueDate: t.due_date,
              createdAt: t.created_at,
              updatedAt: t.updated_at,
              assignee: profile ? profile.full_name || profile.email || null : null,
            };
          }));
        }
      } catch {
        if (mounted) setTasksError(true);
      } finally {
        if (mounted) setTasksLoading(false);
      }
    };

    fetchTasks();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (!projectId) return;

    // Guard file type + size client-side before any upload (same as avatar/EPC).
    for (const file of files) {
      if (!ALLOWED_DOC_TYPES.includes(file.type)) {
        showToast({ type: 'error', message: `${file.name}: only PDF, DOC, DOCX, JPG or PNG files are allowed.` });
        return;
      }
      if (file.size > MAX_DOC_SIZE) {
        showToast({ type: 'error', message: `${file.name}: documents must be 10MB or smaller.` });
        return;
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      showToast({ type: 'error', message: 'You need to be signed in to upload documents.' });
      return;
    }

    // Upload each file into the private bucket under this project's folder,
    // then record the storage PATH in project_documents (RLS: own project only).
    const uploaded = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '_');
      const storagePath = `${projectId}/${Date.now().toString(36)}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(DOC_BUCKET)
        .upload(storagePath, file, { cacheControl: '3600' });
      if (uploadError) {
        showToast({ type: 'error', message: uploadError.message || `Could not upload ${file.name}.` });
        return;
      }
      const { error: insertError } = await supabase.from('project_documents').insert({
        project_id: projectId,
        uploaded_by: user.id,
        file_name: file.name,
        file_path: storagePath,
        file_type: file.type,
      });
      if (insertError) {
        showToast({ type: 'error', message: insertError.message || `Could not save ${file.name}.` });
        return;
      }
      uploaded.push(file.name);
    }

    setFeedback(`Uploaded ${uploaded.length} document${uploaded.length > 1 ? 's' : ''}.`);
    showToast({ type: 'success', message: `Uploaded ${uploaded.length} document${uploaded.length > 1 ? 's' : ''}` });
    await fetchDocuments();
  }

  // View/download a stored document via a short-lived signed URL (private bucket).
  async function viewDocument(doc) {
    if (!doc.filePath) return;
    setViewingDoc(doc.id);
    try {
      const { data, error } = await supabase.storage
        .from(DOC_BUCKET)
        .createSignedUrl(doc.filePath, 60);
      if (error) {
        showToast({ type: 'error', message: error.message || 'Could not open document.' });
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener');
    } catch {
      showToast({ type: 'error', message: 'Could not open document' });
    } finally {
      setViewingDoc(null);
    }
  }

  async function submitRevision() {
    if (!revisionText.trim()) {
      showToast({ type: 'error', message: 'Please describe your revision' });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      showToast({ type: 'error', message: 'You need to be signed in to send a revision request.' });
      return;
    }

    // Reuses the project_messages thread (type='revision_request') so the
    // request inherits the existing client RLS (own project + own sender) and
    // shows up in the Communication tab thread without any new UI. Chat
    // messages keep the default type='message'.
    const { error } = await supabase.from('project_messages').insert({
      project_id: projectId,
      sender_id: user.id,
      body: revisionText.trim(),
      type: 'revision_request',
    });
    if (error) {
      showToast({ type: 'error', message: error.message || 'Could not send the revision request.' });
      return;
    }

    setFeedback('Revision request sent to your project team.');
    setRevisionOpen(false);
    setRevisionText('');
    showToast({ type: 'success', message: 'Revision request sent' });
    // The request lives in the project_messages thread — keep the Project Detail
    // communication badge in sync with the thread.
    window.dispatchEvent(new Event('rp:messages-changed'));
  }

  function downloadReport() {
    const rows = documents.map((d, i) => `${i + 1}. ${d.name} — ${d.meta}`).join('\n');
    const content = `Retrofit Portal — Documents Report\n${'='.repeat(40)}\n\n${rows}\n\nGenerated ${new Date().toLocaleString()}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documents-report-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setFeedback('Report downloaded.');
    showToast({ type: 'success', message: 'Report downloaded' });
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
        <h4 className="font-['Inter'] font-semibold text-[16px] leading-[24px] tracking-[0px] text-[#0B1C30] mb-4">Project Tasks</h4>
        {tasksLoading ? (
          <p className="text-sm text-muted py-2">Loading tasks...</p>
        ) : tasksError ? (
          <p className="text-sm text-muted py-2">Couldn't load tasks.</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted py-2">No tasks yet.</p>
        ) : (
          <div className="space-y-1">
            {tasks.map((t, i) => (
              <div
                key={t.id}
                className={`flex items-center gap-3 py-4 ${i !== tasks.length - 1 ? 'border-b border-dashed border-line' : ''}`}
              >
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-ink" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{t.title}</p>
                  <p className="text-xs text-muted">
                    {t.assignee ? `Assigned to ${t.assignee}` : 'Unassigned'}
                    {t.dueDate ? ` • Due ${t.dueDate}` : ''}
                  </p>
                </div>
                <span className="text-xs font-bold text-brand-green capitalize">{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-2xl border border-line/60 shadow-sm p-6">
          <h4 className="font-['Inter'] font-semibold text-[16px] leading-[24px] tracking-[0px] text-[#0B1C30] mb-4">Your Documents</h4>
          {feedback && (
            <p className="text-xs text-brand-green font-medium mb-4">{feedback}</p>
          )}
          <div className="space-y-1">
            {docsLoading ? (
              <p className="text-sm text-muted py-4">Loading documents...</p>
            ) : docsError ? (
              <p className="text-sm text-muted py-4">Couldn't load documents.</p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-muted py-4">No documents uploaded yet.</p>
            ) : (
              documents.map((d, i) => (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 py-4 ${i !== documents.length - 1 ? 'border-b border-dashed border-line' : ''}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-ink" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">{d.name}</p>
                    <p className="text-xs text-muted">{d.meta}</p>
                  </div>
                  <Button
                    variant="outline"
                    icon={ExternalLink}
                    className="!py-1.5 !px-3 text-xs"
                    disabled={viewingDoc === d.id}
                    onClick={() => viewDocument(d)}
                  >
                    {viewingDoc === d.id ? 'Opening…' : 'View'}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 space-y-3 h-fit">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            icon={Upload}
            className="w-full !justify-start"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Documents
          </Button>
          <Button
            variant="outline"
            icon={FilePenLine}
            className="w-full !justify-start"
            onClick={() => setRevisionOpen((open) => !open)}
          >
            Request Revision
          </Button>
          {revisionOpen && (
            <div className="border border-line rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="revision-text" className="text-xs font-semibold text-ink">Describe your revision</label>
                  <button
                    onClick={() => setRevisionOpen(false)}
                    className="text-muted hover:text-ink"
                    aria-label="Close"
                  >
                    <X size={14} />
                  </button>
                </div>
                <textarea
                  id="revision-text"
                  value={revisionText}
                  onChange={(e) => setRevisionText(e.target.value)}
                  rows={3}
                  placeholder="e.g. Please update the EPC figures..."
                  className="w-full rounded-xl bg-surface px-4 py-3 text-sm focus:outline-none resize-none"
                />
              <Button
                variant="primary"
                icon={Send}
                size="small"
                disabled={!revisionText.trim()}
                className="w-full"
                onClick={submitRevision}
              >
                Send Request
              </Button>
            </div>
          )}
          <Button variant="green" icon={Download} className="w-full" onClick={downloadReport}>
            Download Report
          </Button>
        </div>
      </div>
    </>
  );
}