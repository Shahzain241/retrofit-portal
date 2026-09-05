import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import ProjectHeaderCard from '../../components/ProjectHeaderCard';
import ProjectTabs from '../../components/ProjectTabs';
import OverviewTab from './project-tabs/OverviewTab';
import TaskDocsTab from './project-tabs/TaskDocsTab';
import CommunicationTab from './project-tabs/CommunicationTab';
import TimelineTab from './project-tabs/TimelineTab';
import DeliverablesTab from './project-tabs/DeliverablesTab';
import { supabase } from '../../lib/supabaseClient';

// Generic avatar placeholder (profiles table has no avatar column yet).
const PLACEHOLDER_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#e6e9ef"/><circle cx="32" cy="24" r="11" fill="#98a2b3"/><path d="M12 56c2-10 11-15 20-15s18 5 20 15z" fill="#98a2b3"/></svg>`,
  );

const STAFF_ROLES = ['coordinator', 'designer', 'assessor'];

/** Derive a human name from an email local-part when full_name is missing. */
function friendlyName(email) {
  if (!email) return '';
  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

/** Clean, human-readable project reference ("RET-2026-0042"). Uses the
 *  `reference` column when present; otherwise derives a stable one from the
 *  project id + creation year so raw ids never leak into the UI. */
export function formatProjectReference(project) {
  if (project?.reference) return project.reference;
  const raw = String(project?.id || '');
  const year = project?.createdAt
    ? new Date(project.createdAt).getFullYear()
    : new Date().getFullYear();
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const seq = String((hash >>> 0) % 10000).padStart(4, '0');
  return `RET-${year}-${seq}`;
}

export default function ProjectDetail() {
  const { id: projectId } = useParams();
  const [tab, setTab] = useState('overview');
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  // Live count of ALL project_messages rows for this project (same query the
  // Communication tab thread renders — revision requests included), so the tab
  // badge always matches the chat body. RLS-scoped to the owning client.
  const refreshMessageCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('project_messages')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);
    if (!error) setMessageCount(count ?? 0);
  }, [projectId]);

  useEffect(() => {
    refreshMessageCount();
  }, [refreshMessageCount]);

  // Keep the badge in sync when a message / revision request is sent anywhere
  // in this project (CommunicationTab send, TaskDocsTab revision request).
  useEffect(() => {
    window.addEventListener('rp:messages-changed', refreshMessageCount);
    return () => window.removeEventListener('rp:messages-changed', refreshMessageCount);
  }, [refreshMessageCount]);

  useEffect(() => {
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
          name: c.full_name || friendlyName(c.email) || 'Coordinator',
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

        if (mounted) {
          setProject({
            id: data.id,
            name: data.name,
            reference: data.reference ?? null,
            createdAt: data.created_at ?? null,
            address: {
              line1: data.address_line1,
              city: data.address_city,
              postcode: data.address_postcode,
            },
            status: data.status,
            progress: data.progress ?? 0,
            tag: data.service,
            image: undefined,
            coordinatorId: coordinator.id,
            coordinator,
            // No backing columns on projects yet — clearly-labeled placeholders:
            currentPhase: '—',
            phaseDescription: '—',
            notice: '',
          });
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
  }, [projectId]);

  if (loading) {
    return (
      <div className="text-center py-16 text-muted">Loading project...</div>
    );
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

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted mb-2">
        <Link to="/projects" className="hover:text-ink">Project</Link>
        <ChevronRight size={14} />
        <span className="text-ink font-medium">{formatProjectReference(project)}</span>
      </div>
      <h1 className="text-3xl font-bold text-ink mb-1">{formatProjectReference(project)}</h1>
      <p className="text-body mb-6">{project.name || project.address?.line1 || 'Retrofit Project'}</p>

      <ProjectHeaderCard project={project} />

      <ProjectTabs active={tab} onChange={setTab} badges={{ communication: messageCount }} />
      {tab === 'overview' && <OverviewTab project={project} />}
      {tab === 'tasks' && <TaskDocsTab project={project} />}
      {tab === 'communication' && <CommunicationTab project={project} />}
      {tab === 'timeline' && <TimelineTab project={project} />}
      {tab === 'deliverables' && <DeliverablesTab project={project} />}
    </div>
  );
}