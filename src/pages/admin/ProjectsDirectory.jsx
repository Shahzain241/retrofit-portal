import { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Toggle from '../../components/Toggle';
import ProgressBar from '../../components/ProgressBar';
import { directoryProjects, clientById, formatAddress } from '../../data/projects';
import { directoryFilterFields } from '../../data/projectsDirectory';
import '../../styles/ProjectsDirectory.css';

/**
 * Admin Projects Directory — status filters, "has issues" toggle and the full
 * project table. Styled via ProjectsDirectory.css + Tailwind utilities.
 */
export default function ProjectsDirectory() {
  const [hasIssues, setHasIssues] = useState(true);
  return (
    <div>
      <h1 className="font-['Inter'] font-semibold text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1C30]">Projects Directory</h1>
      <p className="text-body mt-1 mb-6">
        Manage, filter, and track all active enterprise sustainability initiatives.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {directoryFilterFields.map((f) => (
          <div
            key={f.id}
            className="rp-filter-card"
          >
            <label htmlFor={f.id} className="block text-[11px] font-semibold text-muted mb-2">{f.label}</label>
            <select id={f.id} className="rp-filter-select w-full text-sm text-ink bg-white focus:outline-none">
              <option>{f.value}</option>
            </select>
          </div>
        ))}
        <div
          className="rp-filter-card"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-muted">HAS ISSUES</p>
            <Toggle aria-label="Filter by projects with issues" on={hasIssues} onClick={() => setHasIssues((v) => !v)} size="sm" variant="brand" />
          </div>
          <div className="rp-filter-value">
            <span className="text-sm text-ink">Critical Only</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
        <span className="rp-filter-label">
          Active filters:
        </span>
        <span className="rp-filter-chip">
          <span className="rp-filter-chip-label">
            Status: 2 Selected
          </span>
          <X size={10} className="text-[#0B1C30]" />
        </span>
        <button className="rp-filter-clear">
          Clear all
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[900px]">
          <thead>
            <tr className="text-xs font-semibold text-muted uppercase border-b border-line">
              <th className="px-6 py-4"></th>
              <th className="px-6 py-4">Project ID</th>
              <th className="px-6 py-4">Client</th>
              <th className="px-6 py-4">Address</th>
              <th className="px-6 py-4">Service</th>
              <th className="px-6 py-4">Progress</th>
            </tr>
          </thead>
          <tbody>
            {directoryProjects.map((p) => {
              const client = clientById[p.clientId];
              return (
              <tr key={p.id} className="border-b border-line/60 last:border-0">
                <td className="px-6 py-4">
                  <CheckCircle2
                    size={18}
                    className={p.hasIssues ? 'text-danger' : 'text-brand-green'}
                    fill={p.hasIssues ? 'transparent' : '#1fae5c'}
                    color={p.hasIssues ? '#e0432c' : 'white'}
                  />
                </td>
                <td className="px-6 py-4 font-medium text-ink">{p.id}</td>
                <td className="px-6 py-4">
                  <p className="text-ink text-sm font-medium">{client.name}</p>
                  <p className="text-xs text-muted">{client.email}</p>
                </td>
                <td className="px-6 py-4 text-body">{formatAddress(p)}</td>
                <td className="px-6 py-4 text-body">{p.service}</td>
                <td className="px-6 py-4 w-52">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <ProgressBar value={p.progress} size="sm" variant={p.hasIssues ? 'danger' : 'green'} />
                    </div>
                    <span className={`text-sm font-bold ${p.hasIssues ? 'text-danger' : 'text-brand-green'}`}>
                      {p.progress}%
                    </span>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3 mt-4">
        <button aria-label="Previous page" className="w-9 h-9 rounded-full bg-navy-900 text-white flex items-center justify-center">
          <ChevronLeft size={16} />
        </button>
        <button aria-label="Next page" className="w-9 h-9 rounded-full bg-navy-900 text-white flex items-center justify-center">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
