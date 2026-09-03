import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  Download,
  File,
  FileText,
  Star,
  TrendingUp,
} from 'lucide-react';
import Button from '../../components/Button';
import ProgressBar from '../../components/ProgressBar';
import { label, USER_ROLE } from '../../data/enums';
import { supabase } from '../../lib/supabaseClient';

// Generic avatar placeholder (profiles table has no avatar column yet).
const PLACEHOLDER_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#e6e9ef"/><circle cx="32" cy="24" r="11" fill="#98a2b3"/><path d="M12 56c2-10 11-15 20-15s18 5 20 15z" fill="#98a2b3"/></svg>`,
  );

const STAFF_ROLES = ['coordinator', 'designer', 'assessor'];

/** "2026-10-24" -> "Oct 24, 2026" (target-completion style). */
function formatTargetDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "2026-02-10T..." -> "10 Feb 2026" (document upload style). */
function formatUploadDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format a numeric grant amount as GBP currency; "—" when no value is bound. */
function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `£${Number(value).toLocaleString('en-GB')}`;
}

const milestoneStateStyles = {
  done: 'bg-brand-green text-white',
  current: 'bg-warning text-white',
  upcoming: 'bg-line text-muted',
};

const documentIcon = (fileType) => {
  const type = (fileType || '').toLowerCase();
  if (type.includes('pdf')) return FileText;
  if (type.includes('word') || type === 'doc' || type === 'docx') return File;
  return File;
};

/**
 * Project Detail — Figma-aligned layout. Accepts optional `project`,
 * `milestones` and `documents` props (passed by a page wrapper when available);
 * otherwise it self-fetches from Supabase (projects + project_milestones +
 * project_documents), RLS-scoped to the owning client.
 */
export default function ProjectDetail({
  project: projectProp = null,
  milestones: milestonesProp = null,
  documents: documentsProp = null,
  onViewDeliverable,
}) {
  const { id: projectId } = useParams();
  const [project, setProject] = useState(projectProp);
  const [milestones, setMilestones] = useState(milestonesProp);
  const [documents, setDocuments] = useState(documentsProp);
  const [loading, setLoading] = useState(!projectProp);
  const [notFound, setNotFound] = useState(false);

  // Keep state in sync when the wrapper passes fresh props.
  useEffect(() => {
    if (projectProp) setProject(projectProp);
  }, [projectProp]);
  useEffect(() => {
    if (milestonesProp) setMilestones(milestonesProp);
  }, [milestonesProp]);
  useEffect(() => {
    if (documentsProp) setDocuments(documentsProp);
  }, [documentsProp]);

  useEffect(() => {
    if (projectProp) return undefined;
    let mounted = true;

    const fetchProject = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) setNotFound(true);
          return;
        }

        // Scoped by RLS ("Clients can view own projects") — a client fetching
        // another client's project returns no row (single() -> PGRST116).
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();
        if (error || !data) {
          if (mounted) setNotFound(true);
          return;
        }

        const { data: staffRows, error: staffError } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .in('role', STAFF_ROLES);
        if (staffError) throw new Error(staffError.message);

        const coordinators = (staffRows ?? []).map((c) => ({
          id: c.id,
          name: c.full_name || c.email || 'Coordinator',
          role: c.role,
          email: c.email,
          avatar: PLACEHOLDER_AVATAR,
        }));
        const coordinator = coordinators[0] ?? {
          id: 'unassigned',
          name: 'Unassigned',
          role: 'coordinator',
          email: '',
          avatar: PLACEHOLDER_AVATAR,
        };

        const [{ data: milestoneRows }, { data: documentRows }] = await Promise.all([
          supabase
            .from('project_milestones')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('project_documents')
            .select('*')
            .eq('project_id', projectId)
            .order('uploaded_at', { ascending: false }),
        ]);

        if (mounted) {
          setProject({
            id: data.id,
            title: [data.address_line1, data.name].filter(Boolean).join(' - '),
            status: data.status,
            progress: data.progress ?? 0,
            dueDate: data.due_date ?? null,
            grantAmount: data.grant_amount ?? null,
            coordinator,
          });
          setMilestones((milestoneRows ?? []).map((m) => ({
            id: m.id,
            title: m.title,
            date: m.due_date ? formatTargetDate(m.due_date) : '',
            state: m.state,
            description: m.description ?? '',
            hasDeliverable: m.has_deliverable ?? false,
          })));
          setDocuments((documentRows ?? []).map((d) => ({
            id: d.id,
            name: d.file_name,
            uploadedAt: formatUploadDate(d.uploaded_at),
            fileType: d.file_type,
            filePath: d.file_path,
          })));
        }
      } catch {
        if (mounted) setNotFound(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProject();
    return () => {
      mounted = false;
    };
  }, [projectId, projectProp]);

  async function downloadDocument(doc) {
    if (!doc?.filePath) return;
    const { data, error } = await supabase.storage
      .from('project-documents')
      .createSignedUrl(doc.filePath, 60);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  if (loading) {
    return <div className="text-center py-16 text-muted">Loading project...</div>;
  }

  if (notFound || !project) {
    return (
      <div className="error-state mb-8">
        <AlertTriangle size={40} className="error-state-icon" />
        <p className="error-state-title">Project not found</p>
        <p className="error-state-desc">This project doesn't exist or you don't have access to it.</p>
        <Link to="/projects" className="error-state-action">Back to My Projects</Link>
      </div>
    );
  }

  const coordinator = project.coordinator ?? {};
  const statusLabel = project.status === 'completed' ? 'COMPLETED' : 'IN PROGRESS';
  const grantText = formatCurrency(project.grantAmount);
  const targetText = project.dueDate ? formatTargetDate(project.dueDate) : '—';
  const milestoneList = milestones ?? [];
  const documentList = documents ?? [];

  return (
    <div>
      {/* Top navigation */}
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-ink leading-tight">{project.title}</h1>
        <span className="bg-brand-green-light text-brand-green text-xs font-bold px-3 py-1.5 rounded-full shrink-0">
          {statusLabel}
        </span>
      </div>

      {/* Metrics summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg p-4 border border-line/60 shadow-[0px_4px_4.8px_0px_rgba(11,28,48,0.25)]">
          <div className="w-[35px] h-[35px] rounded-[4px] bg-[rgba(11,28,48,0.11)] flex items-center justify-center mb-3">
            <TrendingUp size={16} className="text-ink" />
          </div>
          <p className="text-2xl font-bold text-brand-green">{project.progress}%</p>
          <div className="mt-2"><ProgressBar value={project.progress} size="sm" /></div>
          <p className="text-[11px] font-semibold tracking-wide text-muted mt-2 uppercase">Overall Progress</p>
        </div>

        <div className="bg-white rounded-lg p-4 border border-line/60 shadow-[0px_4px_4.8px_0px_rgba(11,28,48,0.25)]">
          <div className="w-[35px] h-[35px] rounded-[4px] bg-[rgba(11,28,48,0.11)] flex items-center justify-center mb-3">
            <Star size={16} className="text-ink" />
          </div>
          <p className="text-2xl font-bold text-brand-green">{grantText}</p>
          <p className="text-[11px] font-semibold tracking-wide text-muted mt-2 uppercase">Grant Funding</p>
        </div>

        <div className="bg-white rounded-lg p-4 border border-line/60 shadow-[0px_4px_4.8px_0px_rgba(11,28,48,0.25)]">
          <div className="w-[35px] h-[35px] rounded-[4px] bg-[rgba(11,28,48,0.11)] flex items-center justify-center mb-3">
            <CalendarDays size={16} className="text-ink" />
          </div>
          <p className="text-xl font-bold text-ink leading-snug">{targetText}</p>
          <p className="text-[11px] font-semibold tracking-wide text-muted mt-2 uppercase">Estimated Completion</p>
        </div>

        <div className="bg-white rounded-lg p-4 border border-line/60 shadow-[0px_4px_4.8px_0px_rgba(11,28,48,0.25)]">
          <img
            src={coordinator.avatar ?? PLACEHOLDER_AVATAR}
            alt={coordinator.name ?? 'Coordinator'}
            className="w-9 h-9 rounded-full object-cover mb-3"
          />
          <p className="font-bold text-ink text-sm truncate">{coordinator.name ?? 'Unassigned'}</p>
          <p className="text-xs text-muted">{label(USER_ROLE, coordinator.role)}</p>
          <p className="text-[11px] font-semibold tracking-wide text-muted mt-2 uppercase">Assigned Coordinator</p>
        </div>
      </div>

      {/* Two-column main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Timeline & Milestones */}
        <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
          <h3 className="text-lg font-bold text-ink mb-6">Project Milestones &amp; Timeline</h3>
          {milestoneList.length === 0 ? (
            <p className="text-sm text-muted py-4">No milestones yet.</p>
          ) : (
            <div className="space-y-0">
              {milestoneList.map((m, i) => (
                <div key={m.id ?? i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${milestoneStateStyles[m.state] ?? milestoneStateStyles.upcoming}`}>
                      {m.state === 'done' ? <Check size={16} /> : <Clock size={16} />}
                    </div>
                    {i !== milestoneList.length - 1 && (
                      <div className={`w-0.5 flex-1 min-h-[48px] ${m.state === 'done' ? 'bg-brand-green' : 'bg-line'}`} />
                    )}
                  </div>
                  <div className="pb-8">
                    <p className={`font-semibold text-ink ${m.state === 'upcoming' ? '!text-muted' : ''}`}>{m.title}</p>
                    {m.date && <p className="text-sm text-muted mt-0.5">{m.date}</p>}
                    {m.description && <p className="text-sm text-body mt-1">{m.description}</p>}
                    {m.hasDeliverable && (
                      <button
                        type="button"
                        onClick={() => onViewDeliverable?.(m)}
                        className="mt-2 text-sm font-semibold text-brand-green hover:underline"
                      >
                        View Report
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Documents + Coordinator Support */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
            <h3 className="text-lg font-bold text-ink mb-4">Project Documents &amp; Contracts</h3>
            {documentList.length === 0 ? (
              <p className="text-sm text-muted py-4">No documents yet.</p>
            ) : (
              <ul className="space-y-3">
                {documentList.map((doc) => {
                  const DocIcon = documentIcon(doc.fileType);
                  return (
                    <li key={doc.id} className="flex items-center gap-3 border border-line rounded-xl px-4 py-3">
                      <span className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center shrink-0">
                        <DocIcon size={18} className="text-ink" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{doc.name}</p>
                        {doc.uploadedAt && <p className="text-xs text-muted">Uploaded {doc.uploadedAt}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadDocument(doc)}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-green hover:underline shrink-0"
                      >
                        <Download size={14} />
                        Download
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
            <h3 className="text-lg font-bold text-ink mb-4">Coordinator Support &amp; Contact</h3>
            <div className="flex items-center gap-3 mb-5">
              <img
                src={coordinator.avatar ?? PLACEHOLDER_AVATAR}
                alt={coordinator.name ?? 'Coordinator'}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <p className="font-semibold text-ink">{coordinator.name ?? 'Unassigned'}</p>
                <p className="text-xs text-muted">{label(USER_ROLE, coordinator.role)}</p>
                {coordinator.email && <p className="text-xs text-muted">{coordinator.email}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="navy" className="!bg-[#0b1c30]">Send Message</Button>
              <Button variant="navy" className="!bg-[#0b1c30]">Book Call</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}