import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/Button';
import StatusPill from '../../components/StatusPill';
import { Plus } from 'lucide-react';
import { projects } from '../../data/projects';

const filters = ['All', 'Active', 'Completed'];

export default function MyProjects() {
  const [filter, setFilter] = useState('All');

  const list = projects.filter((p) => {
    if (filter === 'All') return true;
    if (filter === 'Active') return p.status !== 'Completed';
    return p.status === 'Completed';
  });

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Your Projects</h1>
          <p className="text-body mt-1">Manage and track your ongoing retrofit operations across all location</p>
        </div>
        <Button variant="navy" icon={Plus}>New Project</Button>
      </div>

      <div className="flex gap-2 mb-6">
        {filters.map((f) => (
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

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm overflow-hidden">
        <table className="w-full text-left">
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
                <td className="px-6 py-5 text-body">{p.fullAddress}</td>
                <td className="px-6 py-5 w-64">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden">
                      <div className="h-full bg-brand-green" style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="text-brand-green font-bold text-sm">{p.progress}%</span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <StatusPill>{p.status === 'Completed' ? 'Completed' : 'Coordination'}</StatusPill>
                </td>
                <td className="px-6 py-5 text-right">
                  <Link to={`/projects/${p.id}`}>
                    <Button variant="navy" className="!py-2 !px-6">View</Button>
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
