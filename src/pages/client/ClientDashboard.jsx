import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FolderOpen,
  Star,
  Zap,
} from 'lucide-react';
import StatCard from '../../components/StatCard';
import Button from '../../components/Button';
import ProgressBar from '../../components/ProgressBar';
import UpgradeBanner from '../../components/UpgradeBanner';
import { label, USER_ROLE } from '../../data/enums';
import { useProfile } from '../../context/ProfileContext';
import { supabase } from '../../lib/supabaseClient';
import clientdash1 from '../../assets/clientdash1.png';
import clientdash2 from '../../assets/clientdash2.png';
import clientdash3 from '../../assets/clientdash3.png';
import '../../styles/ClientDashboard.css';
import '../../styles/PublicServices.css';

/**
 * Client Dashboard — welcome banner, headline stats, active project cards and
 * an upgrade-to-priority panel, backed by live Supabase data scoped to the
 * logged-in client (RLS: "Clients can view own projects"). Styled via
 * ClientDashboard.css + Tailwind.
 */

// Fallback gallery used by the project cards (projects table has no image col).
const clientProjectImages = [clientdash1, clientdash2, clientdash3];

// Generic avatar placeholder (profiles table has no avatar column yet).
const PLACEHOLDER_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#e6e9ef"/><circle cx="32" cy="24" r="11" fill="#98a2b3"/><path d="M12 56c2-10 11-15 20-15s18 5 20 15z" fill="#98a2b3"/></svg>`,
  );

const PROJECT_COLUMNS =
  'id, name, status, progress, address_line1, address_city, address_postcode, service, has_issues, created_at, client_id, due_date, updated_at';
const STAFF_ROLES = ['coordinator', 'designer', 'assessor'];

export default function ClientDashboard() {
  const { profile } = useProfile();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [projects, setProjects] = useState([]);
  const [clientStats, setClientStats] = useState([]);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data: projectRows, error: projectsError } = await supabase
        .from('projects')
        .select(PROJECT_COLUMNS)
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });
      if (projectsError) throw new Error(projectsError.message);

      const { data: staffRows, error: staffError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', STAFF_ROLES);
      if (staffError) throw new Error(staffError.message);

      const { data: invoiceRows, error: invoicesError } = await supabase
        .from('invoices')
        .select('amount')
        .eq('user_id', user.id);
      if (invoicesError) throw new Error(invoicesError.message);

      const coordinators = (staffRows ?? []).map((c) => ({
        id: c.id,
        name: c.full_name || c.email || 'Coordinator',
        role: c.role,
        email: c.email,
        avatar: PLACEHOLDER_AVATAR,
      }));
      const nextCoordinatorById = Object.fromEntries(coordinators.map((c) => [c.id, c]));
      if (coordinators.length === 0) {
        nextCoordinatorById.unassigned = {
          id: 'unassigned',
          name: 'Unassigned',
          role: 'coordinator',
          email: '',
          avatar: PLACEHOLDER_AVATAR,
        };
      }
      const primaryCoordinatorId = coordinators[0]?.id ?? 'unassigned';

      const primaryCoordinator = nextCoordinatorById[primaryCoordinatorId] ?? {
        id: 'unassigned',
        name: 'Unassigned',
        role: 'coordinator',
        avatar: PLACEHOLDER_AVATAR,
      };

      const mapped = (projectRows ?? []).map((p, i) => ({
        id: p.id,
        title: p.address_line1 || p.name || 'Untitled project',
        description: p.name || '',
        category: p.service || '',
        coverImage: clientProjectImages[i % clientProjectImages.length],
        status: p.status,
        progress: p.progress ?? 0,
        coordinator: {
          avatar: primaryCoordinator.avatar,
          name: primaryCoordinator.name,
          role: primaryCoordinator.role,
        },
      }));

      setProjects(mapped);

      const activeCount = mapped.filter((p) => p.status === 'active').length;
      const completedCount = mapped.filter((p) => p.status === 'completed').length;

      // "Funding Secured" = sum of the client's invoices. There is no
      // funding/grant column on `projects`, so the only real client-scoped
      // money source is the `invoices` table (RLS: owner reads only).
      const fundingSecured = (invoiceRows ?? []).reduce(
        (sum, inv) => sum + (Number.isFinite(Number(inv.amount)) ? Number(inv.amount) : 0),
        0,
      );
      const fundingText = `£${fundingSecured.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

      setClientStats([
        { id: 'stat-active-projects', icon: ClipboardCheck, value: activeCount, label: 'Active Projects' },
        { id: 'stat-completed', icon: CheckCircle2, value: completedCount, label: 'Completed' },
        { id: 'stat-funding-secured', icon: Star, value: fundingText, label: 'Funding Secured' },
        // Compliance has no backing table/feature yet — honest placeholder,
        // never a fabricated figure.
        { id: 'stat-compliance', icon: Zap, value: '—', label: 'Compliance' },
      ]);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Refetch when a new project is created (Sidebar / MyProjects) so the stats
  // and active-project cards update immediately.
  useEffect(() => {
    window.addEventListener('rp:project-created', fetchDashboard);
    return () => window.removeEventListener('rp:project-created', fetchDashboard);
  }, [fetchDashboard]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (key === 'e' && event.shiftKey && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setHasError((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const retryFetch = () => fetchDashboard();

  // Same live count rendered by the "Active Projects" stat card below — the
  // greeting must never drift from it.
  const activeCount = clientStats.find((s) => s.id === 'stat-active-projects')?.value ?? 0;

  return (
    <div>
      <div className="dashboard-banner dashboard-banner-client rounded-3xl text-white p-6 sm:p-8">
        <div className="dashboard-banner-rings">
          <span className="ring ring-1" />
          <span className="ring ring-2" />
        </div>
        <h1 className="font-['Inter'] font-bold text-[32px] leading-[40px] tracking-[-0.64px] align-middle text-white relative z-10">Good morning {profile.firstName}!</h1>
        <p className="text-white/70 mt-2 relative z-10">
          You have <span className="text-[#10B981] font-bold">{activeCount} active project{activeCount === 1 ? '' : 's'}</span> that
          require attention today.
        </p>
      </div>

      {hasError ? (
        <div className="error-state mb-10">
          <AlertTriangle size={40} className="error-state-icon" />
          <p className="error-state-title">Couldn't load dashboard</p>
          <p className="error-state-desc">Something went wrong. Please try again.</p>
          <button onClick={retryFetch} className="error-state-action">Retry</button>
        </div>
      ) : (
        <div className="dashboard-stats-grid grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-10">
          {isLoading
            ? clientStats.map((_, i) => <StatCardSkeleton key={i} />)
            : clientStats.map((s, i) => (
                <StatCard key={i} icon={s.icon} value={s.value} label={s.label} />
              ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-['Inter'] font-semibold text-[24px] leading-[32px] tracking-[-0.24px] text-[#0B1C30]">Your Active Projects</h2>
        <Link to="/projects" className="text-sm font-semibold text-ink flex items-center gap-1">
          View All <ChevronRight size={16} />
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state mb-8">
          <FolderOpen size={40} className="empty-state-icon" />
          <p className="empty-state-title">No active projects yet</p>
          <p className="empty-state-desc">Start a retrofit project to see it here.</p>
          <Link to="/services" className="empty-state-action">Browse Services</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {projects.map((project) => {
          const isInProgress = project.status !== 'completed';
          const statusChip = isInProgress
            ? 'bg-brand-green-light text-brand-green'
            : 'bg-line text-muted';
          return (
          <div
            key={project.id}
            className="overflow-hidden rp-dash-proj-card"
          >
            <div className="relative rp-dash-proj-img">
              <img
                src={project.coverImage}
                alt={project.title}
                className="w-full h-full object-cover"
              />
              <span className={`absolute top-3 left-3 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${statusChip}`}>
                {isInProgress ? <Check size={12} /> : <CheckCircle2 size={12} />}
                {isInProgress ? 'IN PROGRESS' : 'COMPLETED'}
              </span>
            </div>
            <div className="p-5">
              <h3 className="rp-dash-proj-title font-bold text-ink text-lg">
                {project.title}
              </h3>
              <p className="rp-dash-proj-meta mt-1">
                {project.description || project.category}
              </p>

              <div className="mt-4 px-3 py-2">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-body">Progress</span>
                  <span className="text-brand-green font-bold">{project.progress}%</span>
                </div>
                <ProgressBar value={project.progress} size="sm" />
              </div>

              <div className="flex items-center gap-2 mt-4">
                <img src={project.coordinator.avatar} alt={project.coordinator.name} className="w-8 h-8 rounded-full object-cover" />
                <div>
                  <p className="text-sm font-semibold text-ink">{project.coordinator.name}</p>
                  <p className="text-xs text-muted">{label(USER_ROLE, project.coordinator.role)}</p>
                </div>
              </div>

              <Link to={`/projects/${project.id}`}>
                <Button
                  variant="gradient"
                  className="w-full mt-14 rp-dash-proj-btn"
                >
                  Open Project
                </Button>
              </Link>
            </div>
          </div>
          );
        })}
        </div>
      )}

      <UpgradeBanner />
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="stat-card-skeleton">
      <div className="skeleton-block skeleton-stat-icon" />
      <div className="skeleton-block skeleton-stat-value" />
      <div className="skeleton-block skeleton-stat-label" />
    </div>
  );
}
