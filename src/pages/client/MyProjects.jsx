import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import StatusPill from '../../components/StatusPill';
import ProgressBar from '../../components/ProgressBar';
import NewProjectModal from '../../components/NewProjectModal';
import { Plus } from 'lucide-react';
import { projectFilters } from '../../data/projectFilters';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/MyProjects.css';

/**
 * Client "My Projects" — filterable table of the current user's retrofit
 * projects, backed by live Supabase data scoped to the logged-in client
 * (RLS: "Clients can view own projects"). Styled via MyProjects.css +
 * shared dashboard classes.
 */

/** Full single-line address, e.g. "42 Maple Avenue, London NW10 6RF". */
function formatAddress(project) {
  const { line1, city, postcode } = project.address;
  return `${line1}, ${city} ${postcode}`;
}

export default function MyProjects() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [projects, setProjects] = useState([]);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[MyProjects] failed to load projects', error.message, error);
      return;
    }
    setProjects((data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      address: {
        line1: p.address_line1,
        city: p.address_city,
        postcode: p.address_postcode,
      },
      progress: p.progress ?? 0,
      status: p.status,
    })));
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Refetch when a new project is created anywhere in the app (Sidebar or the
  // New Project button here) so the table reflects it immediately.
  useEffect(() => {
    window.addEventListener('rp:project-created', fetchProjects);
    return () => window.removeEventListener('rp:project-created', fetchProjects);
  }, [fetchProjects]);

  const list = projects.filter((p) => {
    if (filter === 'All') return true;
    if (filter === 'Active') return p.status !== 'completed';
    return p.status === 'completed';
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-['Inter'] font-semibold text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1C30]">Your Projects</h1>
          <p className="text-body mt-1">Manage and track your ongoing retrofit operations across all location</p>
        </div>
        <Button
          variant="gradientEdge"
          icon={Plus}
          className="rp-dash-cta rp-new-project-btn shrink-0"
          onClick={() => setNewProjectOpen(true)}
        >
          New Project
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {projectFilters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              filter === f ? 'bg-brand-green text-white' : 'bg-white border border-line text-body'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[640px]">
          <thead>
            <tr className="text-xs font-semibold text-muted uppercase border-b border-line">
              <th className="px-6 py-4">Project ID</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Progress</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="px-6 py-5 font-medium text-ink">{p.id}</td>
                <td className="px-6 py-5 text-body">{formatAddress(p)}</td>
                <td className="px-6 py-5 w-64">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <ProgressBar value={p.progress} size="sm" />
                    </div>
                    <span className="text-brand-green font-bold text-sm">{p.progress}%</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <StatusPill>{p.status === 'completed' ? 'Completed' : 'Coordination'}</StatusPill>
                </td>
                <td className="px-6 py-5 text-right">
                  <Button
                    variant="gradient"
                    type="button"
                    className="rp-table-btn-view !py-2 !px-6"
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NewProjectModal
        isOpen={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
      />
    </div>
  );
}
