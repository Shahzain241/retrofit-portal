import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Toggle from '../../components/Toggle';
import ProgressBar from '../../components/ProgressBar';
import { supabase } from '../../lib/supabaseClient';
import { label, PROJECT_STATUS } from '../../data/enums';
import '../../styles/ProjectsDirectory.css';

const PAGE_SIZE = 10;
const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

/**
 * Admin Projects Directory — status / has-issues / date-range filters (real
 * Supabase WHERE clauses over the projects table), an honest "Coming soon"
 * ASSIGNED TO filter (there is no coordinator/assignee concept on projects),
 * dynamic active-filter chips + Clear all, and real pagination.
 * Styled via ProjectsDirectory.css + Tailwind utilities.
 */
export default function ProjectsDirectory() {
  const [hasIssues, setHasIssues] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateRange, setDateRange] = useState('all');
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('projects')
        .select('*, client:profiles(full_name, email)', { count: 'exact' })
        .order('created_at', { ascending: false });
      if (hasIssues) query = query.eq('has_issues', true);
      if (statusFilter !== 'All') query = query.eq('status', statusFilter);
      if (dateRange !== 'all') {
        const since = new Date(Date.now() - Number(dateRange) * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', since);
      }
      query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      const { data, count, error: fetchError } = await query;
      if (fetchError) throw new Error(fetchError.message);
      setProjects(data ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      setError(err?.message || 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, [hasIssues, statusFilter, dateRange, page]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // A filter change should start back at page 1.
  useEffect(() => {
    setPage(1);
  }, [hasIssues, statusFilter, dateRange]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const activeFilters = [
    statusFilter !== 'All' && { key: 'status', label: `Status: ${label(PROJECT_STATUS, statusFilter)}`, clear: () => setStatusFilter('All') },
    dateRange !== 'all' && { key: 'date', label: `Date: ${DATE_RANGE_OPTIONS.find((d) => d.value === dateRange)?.label ?? dateRange}`, clear: () => setDateRange('all') },
    hasIssues && { key: 'issues', label: 'Has issues', clear: () => setHasIssues(false) },
  ].filter(Boolean);

  function clearAll() {
    setHasIssues(false);
    setStatusFilter('All');
    setDateRange('all');
    setPage(1);
  }

  return (
    <div>
      <h1 className="font-['Inter'] font-semibold text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1C30]">Projects Directory</h1>
      <p className="text-body mt-1 mb-6">
        Manage, filter, and track all active enterprise sustainability initiatives.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="rp-filter-card">
          <label htmlFor="filter-status" className="block text-[11px] font-semibold text-muted mb-2">STATUS</label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rp-filter-select w-full text-sm text-ink bg-white focus:outline-none"
          >
            <option value="All">All statuses</option>
            {Object.keys(PROJECT_STATUS).map((s) => (
              <option key={s} value={s}>{label(PROJECT_STATUS, s)}</option>
            ))}
          </select>
        </div>

        <div className="rp-filter-card">
          <label htmlFor="filter-assigned" className="block text-[11px] font-semibold text-muted mb-2">ASSIGNED TO</label>
          <select
            id="filter-assigned"
            disabled
            title="Coming soon — no coordinator/assignee field exists on projects yet"
            className="rp-filter-select w-full text-sm text-muted bg-white focus:outline-none cursor-not-allowed opacity-60"
          >
            <option>Coming soon</option>
          </select>
        </div>

        <div className="rp-filter-card">
          <label htmlFor="filter-date-range" className="block text-[11px] font-semibold text-muted mb-2">DATE RANGE</label>
          <select
            id="filter-date-range"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rp-filter-select w-full text-sm text-ink bg-white focus:outline-none"
          >
            {DATE_RANGE_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div className="rp-filter-card">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-muted">HAS ISSUES</p>
            <Toggle aria-label="Filter by projects with issues" on={hasIssues} onClick={() => setHasIssues((v) => !v)} size="sm" variant="brand" />
          </div>
          <div className="rp-filter-value">
            <span className="text-sm text-ink">{hasIssues ? 'Critical Only' : 'All projects'}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
        <span className="rp-filter-label">
          Active filters:
        </span>
        {activeFilters.length === 0 ? (
          <span className="text-xs text-muted">None</span>
        ) : (
          activeFilters.map((f) => (
            <span key={f.key} className="rp-filter-chip">
              <span className="rp-filter-chip-label">{f.label}</span>
              <button onClick={f.clear} aria-label={`Remove ${f.label} filter`} className="cursor-pointer hover:opacity-70">
                <X size={10} className="text-[#0B1C30]" />
              </button>
            </span>
          ))
        )}
        {activeFilters.length > 0 && (
          <button onClick={clearAll} className="rp-filter-clear">
            Clear all
          </button>
        )}
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
            {loading ? (
              <tr>
                <td className="px-6 py-4 text-body" colSpan={6}>Loading projects...</td>
              </tr>
            ) : error ? (
              <tr>
                <td className="px-6 py-4 text-body" colSpan={6}>Could not load projects.</td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td className="px-6 py-4 text-body" colSpan={6}>No projects match the current filters.</td>
              </tr>
            ) : (
              projects.map((p) => {
                const client = p.client;
                return (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <td className="px-6 py-4">
                    <CheckCircle2
                      size={18}
                      className={p.has_issues ? 'text-danger' : 'text-brand-green'}
                      fill={p.has_issues ? 'transparent' : '#1fae5c'}
                      color={p.has_issues ? '#e0432c' : 'white'}
                    />
                  </td>
                  <td className="px-6 py-4 font-medium text-ink">{p.id}</td>
                  <td className="px-6 py-4">
                    <p className="text-ink text-sm font-medium">{client ? client.full_name : 'Unassigned'}</p>
                    {client && <p className="text-xs text-muted">{client.email}</p>}
                  </td>
                  <td className="px-6 py-4 text-body">{`${p.address_line1}, ${p.address_city} ${p.address_postcode}`}</td>
                  <td className="px-6 py-4 text-body">{p.service}</td>
                  <td className="px-6 py-4 w-52">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <ProgressBar value={p.progress} size="sm" variant={p.has_issues ? 'danger' : 'green'} />
                      </div>
                      <span className={`text-sm font-bold ${p.has_issues ? 'text-danger' : 'text-brand-green'}`}>
                        {p.progress}%
                      </span>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3 mt-4">
        <span className="text-xs text-muted">
          {totalCount > 0 ? `Page ${page} of ${totalPages} (${totalCount} projects)` : 'No projects'}
        </span>
        <button
          aria-label="Previous page"
          className="w-9 h-9 rounded-full bg-navy-900 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          aria-label="Next page"
          className="w-9 h-9 rounded-full bg-navy-900 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}