import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, AlertTriangle, FolderOpen } from 'lucide-react';
import StatCard from '../../components/StatCard';
import Button from '../../components/Button';
import ProgressBar from '../../components/ProgressBar';
import { projects, coordinatorById } from '../../data/projects';
import { clientStats, clientProjectImages } from '../../data/dashboardStats';
import { label, USER_ROLE } from '../../data/enums';
import { useProfile } from '../../context/ProfileContext';
import '../../styles/ClientDashboard.css';
import '../../styles/PublicServices.css';

/**
 * Client Dashboard — welcome banner, headline stats, active project cards and
 * an upgrade-to-priority panel. Styled via ClientDashboard.css + Tailwind.
 */
const FETCH_DELAY_MS = 700;

export default function ClientDashboard() {
  const { profile } = useProfile();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const fetchDashboard = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    window.setTimeout(() => {
      setIsLoading(false);
    }, FETCH_DELAY_MS);
  }, []);

  useEffect(() => {
    fetchDashboard();
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

  return (
    <div>
      <div className="dashboard-banner dashboard-banner-client rounded-3xl text-white p-6 sm:p-8">
        <div className="dashboard-banner-rings">
          <span className="ring ring-1" />
          <span className="ring ring-2" />
        </div>
        <h1 className="font-['Inter'] font-bold text-[32px] leading-[40px] tracking-[-0.64px] align-middle text-white relative z-10">Good morning {profile.firstName}!</h1>
        <p className="text-white/70 mt-2 relative z-10">
          You have <span className="text-brand-green font-semibold">2 active projects</span> that
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
        <div className="dashboard-stats-grid grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 mb-10">
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
          {projects.map((p, i) => {
          const coordinator = coordinatorById[p.coordinatorId];
          return (
          <div
            key={p.id}
            className="overflow-hidden rp-dash-proj-card"
          >
            <div className="relative rp-dash-proj-img">
              <img
                src={clientProjectImages[i] || p.image}
                alt={p.address.line1}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-3 left-3 bg-brand-green-light text-brand-green text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-green" /> IN PROGRESS
              </span>
            </div>
            <div className="p-5">
              <h3 className="rp-dash-proj-title font-bold text-ink text-lg">
                {p.address.line1}
              </h3>
              <p className="rp-dash-proj-meta mt-1">
                {p.name}
              </p>

              <div className="mt-4 px-3 py-2">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-body">Progress</span>
                  <span className="text-brand-green font-bold">{p.progress}%</span>
                </div>
                <ProgressBar value={p.progress} size="sm" />
              </div>

              <div className="flex items-center gap-2 mt-4">
                <img src={coordinator.avatar} alt={coordinator.name} className="w-8 h-8 rounded-full object-cover" />
                <div>
                  <p className="text-sm font-semibold text-ink">{coordinator.name}</p>
                  <p className="text-xs text-muted">{label(USER_ROLE, coordinator.role)}</p>
                </div>
              </div>

              <Link to={`/projects/${p.id}`}>
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

      <div className="rp-upgrade-banner border border-line rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-['Inter'] font-semibold text-[20px] leading-[28px] tracking-[0px] text-[#0B1C30]">Upgrade to Priority Support</h3>
          <p className="text-body text-sm mt-1">
            Get Priority Support for £29/mo — faster responses + 15% off
          </p>
        </div>
        <Link to="/billing/plans" className="w-full sm:w-auto">
          <Button
            variant="green"
            className="w-full sm:w-auto rp-upgrade-btn"
          >
            Upgrade Now
          </Button>
        </Link>
      </div>
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
