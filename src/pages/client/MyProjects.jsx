import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/Button';
import StatusPill from '../../components/StatusPill';
import ProgressBar from '../../components/ProgressBar';
import { Plus } from 'lucide-react';
import { projects, formatAddress } from '../../data/projects';
import { projectFilters } from '../../data/projectFilters';
import { useToast } from '../../context/ToastContext';
import '../../styles/MyProjects.css';

/**
 * Client "My Projects" — filterable table of the current user's retrofit
 * projects. Styled via MyProjects.css + shared dashboard classes.
 */
export default function MyProjects() {
  const [filter, setFilter] = useState('All');
  const { showToast } = useToast();

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
          onClick={() => showToast({ type: 'success', message: 'New project created' })}
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
                  <Link to={`/projects/${p.id}`}>
                    <Button
                      variant="gradient"
                      className="rp-table-btn-view !py-2 !px-6"
                    >
                      View
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
