import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MoreHorizontal, AlertTriangle, Inbox } from 'lucide-react';
import StatCard from '../../components/StatCard';
import Button from '../../components/Button';
import TaskBoardModal from '../../components/TaskBoardModal';
import { teamWorkload, projectByStatus, revenueTrend } from '../../data/misc';
import { priorityQueue } from '../../data/projects';
import { adminStats } from '../../data/dashboardStats';
import { label, PRIORITY } from '../../data/enums';
import { useProfile } from '../../context/ProfileContext';
import '../../styles/AdminDashboard.css';
import '../../styles/PublicServices.css';

/**
 * Admin Dashboard — headline stats, workload/status/revenue charts and the
 * priority queue table. Styled via AdminDashboard.css, DashboardShared.css
 * and Tailwind utilities.
 */
const FETCH_DELAY_MS = 700;

export default function AdminDashboard() {
  const { profile } = useProfile();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isTaskBoardOpen, setIsTaskBoardOpen] = useState(false);
  const [taskBoardProjectId, setTaskBoardProjectId] = useState(null);
  const [revenueHover, setRevenueHover] = useState(null);

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
      <div className="dashboard-banner text-white p-6 sm:p-8 mb-6">
        <div className="dashboard-banner-glow" />
        <h1 className="text-2xl sm:text-3xl font-bold relative z-10">Good morning {profile.firstName}!</h1>
        <p className="text-white/70 mt-2 relative z-10">
          You have <span className="text-brand-green font-semibold">2 pending projects</span> that
          require attention today.
        </p>
      </div>

      {hasError ? (
        <div className="error-state mb-8">
          <AlertTriangle size={40} className="error-state-icon" />
          <p className="error-state-title">Couldn't load dashboard</p>
          <p className="error-state-desc">Something went wrong. Please try again.</p>
          <button onClick={retryFetch} className="error-state-action">Retry</button>
        </div>
      ) : (
        <div className="admin-stats-grid">
          {isLoading
            ? adminStats.map((_, i) => <AdminStatCardSkeleton key={i} />)
            : adminStats.map((s, i) => (
                <StatCard key={i} icon={s.icon} value={s.value} label={s.label} variant={s.variant} compact />
              ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-ink">Team Workload</h4>
            <MoreHorizontal size={18} className="text-muted" />
          </div>
          {teamWorkload.length === 0 ? (
            <div className="empty-state">
              <Inbox size={40} className="empty-state-icon" />
              <p className="empty-state-title">No project data yet</p>
              <p className="empty-state-desc">Team workload will appear here.</p>
              <Link to="/admin/projects" className="empty-state-action">View Projects</Link>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={teamWorkload}>
              <CartesianGrid vertical={false} stroke="#eef0f2" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#667085' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#667085' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {teamWorkload.map((d, i) => (
                  <Cell key={i} fill={i === teamWorkload.length - 1 ? '#1fae5c' : '#c7cbe0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-ink">Project by Status</h4>
            <MoreHorizontal size={18} className="text-muted" />
          </div>
          {projectByStatus.length === 0 ? (
            <div className="empty-state">
              <Inbox size={40} className="empty-state-icon" />
              <p className="empty-state-title">No project data yet</p>
              <p className="empty-state-desc">Project status breakdown will appear here.</p>
              <Link to="/admin/projects" className="empty-state-action">View Projects</Link>
            </div>
          ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-36 h-36 sm:w-40 sm:h-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={projectByStatus}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={72}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {projectByStatus.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-ink">142</p>
                <p className="text-xs text-muted">Total</p>
              </div>
            </div>
            <div className="space-y-3">
              {projectByStatus.map((d) => {
                const dotStyle = { '--dot-color': d.color };
                return (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full legend-dot" style={dotStyle} />
                    <span className="text-body flex-1">{d.name}</span>
                    <span className="font-semibold text-ink">{d.value}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-ink">Revenue Trend</h4>
          <MoreHorizontal size={18} className="text-muted" />
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revenueTrend} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="revenueHighlightFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.16} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={true} horizontal={false} stroke="#e5e7eb" strokeWidth={1} />

            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              tickMargin={8}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              tickFormatter={(v) => `£${v}K`}
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
              width={46}
            />

            <Tooltip
              cursor={false}
              content={<RevenueTooltip onActiveChange={setRevenueHover} />}
            />

            {revenueHover && (
              <ReferenceLine
                x={revenueHover}
                shape={RevenueHighlightBar}
              />
            )}

            <Area
              type="monotone"
              dataKey="value"
              stroke="#22c55e"
              strokeWidth={2.5}
              fill="url(#revenueAreaFill)"
              dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
              activeDot={{ r: 4, fill: '#22c55e', strokeWidth: 2, stroke: '#ffffff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <h3 className="text-xl font-bold text-ink mb-4">Priority Queue</h3>
      <div className="bg-white rounded-2xl border border-line/60 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[900px]">
          <thead>
            <tr className="text-xs font-semibold text-muted uppercase border-b border-line">
              <th className="px-6 py-4">Project ID</th>
              <th className="px-6 py-4">Property</th>
              <th className="px-6 py-4">Issue</th>
              <th className="px-6 py-4">Due Date</th>
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4">Assigned To</th>
              <th className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {priorityQueue.map((q) => (
              <tr key={q.id} className="border-b border-line/60 last:border-0">
                <td className="px-6 py-4 text-ink font-medium">{q.id}</td>
                <td className="px-6 py-4 text-body">{q.property}</td>
                <td className="px-6 py-4 text-body">{q.issue}</td>
                <td className="px-6 py-4 text-body">{q.dueDate}</td>
                <td className="px-6 py-4">
                  <span
                    className={`font-semibold text-sm ${
                      q.priority === 'high' ? 'text-danger' : 'text-warning'
                    }`}
                  >
                    {label(PRIORITY, q.priority)}
                  </span>
                </td>
                <td className="px-6 py-4 text-body">{q.assignedTo ?? 'Unassigned'}</td>
                <td className="px-6 py-4">
                  <Button
                    variant="navy"
                    className="!py-2 !px-5 text-xs"
                    onClick={() => {
                      setTaskBoardProjectId(q.projectId);
                      setIsTaskBoardOpen(true);
                    }}
                  >
                    {q.action}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TaskBoardModal
        open={isTaskBoardOpen}
        onClose={() => setIsTaskBoardOpen(false)}
        projectId={taskBoardProjectId}
      />
    </div>
  );
}

function AdminStatCardSkeleton() {
  return (
    <div className="admin-stat-card">
      <div className="skeleton-block" />
      <div className="skeleton-block" />
      <div className="skeleton-block" />
    </div>
  );
}

function RevenueTooltip({ active, payload, onActiveChange }) {
  const month = active && payload?.length ? payload[0].payload.month : null;

  useEffect(() => {
    onActiveChange(month);
  }, [month, onActiveChange]);

  if (!active || !payload?.length) return null;

  return (
    <div className="revenue-tooltip-pill">
      £{payload[0].value}K
    </div>
  );
}

function RevenueHighlightBar(props) {
  const { points } = props;
  if (!points || points.length < 2) return null;

  const x = points[0].x;
  const top = points[0].y;
  const bottom = points[1].y;

  return (
    <rect
      x={x - 24}
      y={top}
      width={48}
      height={Math.max(0, bottom - top)}
      fill="url(#revenueHighlightFill)"
    />
  );
}
