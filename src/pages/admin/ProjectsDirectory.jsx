import { CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { directoryProjects } from '../../data/projects';

const filterFields = [
  { label: 'STATUS', value: 'Planning' },
  { label: 'ASSIGNED TO', value: 'John Smith' },
  { label: 'DATA RANGE', value: 'Q4 2023 Overview' },
];

export default function ProjectsDirectory() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Projects Directory</h1>
      <p className="text-body mt-1 mb-6">
        Manage, filter, and track all active enterprise sustainability initiatives.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {filterFields.map((f) => (
          <div key={f.label} className="bg-white rounded-2xl border border-line/60 shadow-sm p-4">
            <p className="text-[11px] font-semibold text-muted mb-2">{f.label}</p>
            <select className="w-full text-sm text-ink bg-transparent focus:outline-none">
              <option>{f.value}</option>
            </select>
          </div>
        ))}
        <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-4 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-muted">HAS ISSUES</p>
          <div className="w-10 h-5 rounded-full bg-line flex items-center px-0.5">
            <span className="w-4 h-4 rounded-full bg-white block" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 text-sm">
        <span className="text-body">Active filters:</span>
        <span className="bg-white border border-line rounded-full px-3 py-1.5 flex items-center gap-2 text-ink">
          Status: 2 Selected <X size={14} className="text-muted" />
        </span>
        <button className="text-brand-green font-semibold">Clear all</button>
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
            {directoryProjects.map((p, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="px-6 py-4">
                  <CheckCircle2
                    size={18}
                    className={p.danger ? 'text-danger' : 'text-brand-green'}
                    fill={p.danger ? 'transparent' : '#1fae5c'}
                    color={p.danger ? '#e0432c' : 'white'}
                  />
                </td>
                <td className="px-6 py-4 font-medium text-ink">{p.id}</td>
                <td className="px-6 py-4">
                  <p className="text-ink text-sm font-medium">{p.client}</p>
                  <p className="text-xs text-muted">{p.email}</p>
                </td>
                <td className="px-6 py-4 text-body">{p.address}</td>
                <td className="px-6 py-4 text-body">{p.service}</td>
                <td className="px-6 py-4 w-52">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden">
                      <div
                        className={`h-full ${p.danger ? 'bg-danger' : 'bg-brand-green'}`}
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold ${p.danger ? 'text-danger' : 'text-brand-green'}`}>
                      {p.progress}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3 mt-4">
        <button className="w-9 h-9 rounded-full bg-navy-900 text-white flex items-center justify-center">
          <ChevronLeft size={16} />
        </button>
        <button className="w-9 h-9 rounded-full bg-navy-900 text-white flex items-center justify-center">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
