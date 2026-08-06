import {
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  LineChart,
  Line,
  Tooltip,
} from 'recharts';
import { FileText, ClipboardCheck, Clock, Star, Activity, Zap, MoreHorizontal } from 'lucide-react';
import StatCard from '../../components/StatCard';
import Button from '../../components/Button';
import { teamWorkload, projectByStatus, revenueTrend } from '../../data/misc';
import { priorityQueue } from '../../data/projects';
import { useProfile } from '../../context/ProfileContext';

export default function AdminDashboard() {
  const { profile } = useProfile();
  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 to-navy-800 text-white p-8 mb-6">
        <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full border-[20px] border-brand-green/40" />
        <div className="absolute right-16 bottom-0 w-32 h-32 rounded-full bg-brand-green/30" />
        <h1 className="text-3xl font-bold relative z-10">Good morning {profile.firstName}!</h1>
        <p className="text-white/70 mt-2 relative z-10">
          You have <span className="text-brand-green font-semibold">2 pending projects</span> that
          require attention today.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-5">
        <StatCard icon={FileText} value="2" label="New Today" />
        <StatCard icon={ClipboardCheck} value="4" label="Active Projects" />
        <StatCard icon={Clock} value="4" label="Overdue Tasks" dark />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-8">
        <StatCard icon={Star} value="£1,5054" label="Revenue MTD" />
        <StatCard icon={Activity} value="4" label="Avg Completion" />
        <StatCard icon={Zap} value="100%" label="Compliance" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-ink">Team Workload</h4>
            <MoreHorizontal size={18} className="text-muted" />
          </div>
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
        </div>

        <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-ink">Project by Status</h4>
            <MoreHorizontal size={18} className="text-muted" />
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-40 h-40 shrink-0">
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
              {projectByStatus.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-body flex-1">{d.name}</span>
                  <span className="font-semibold text-ink">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-ink">Revenue Trend</h4>
          <MoreHorizontal size={18} className="text-muted" />
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={revenueTrend}>
            <CartesianGrid vertical={false} stroke="#eef0f2" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#667085' }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: '#667085' }}
              tickFormatter={(v) => `£${v}K`}
            />
            <Tooltip formatter={(v) => `£${v}K`} />
            <Line type="monotone" dataKey="value" stroke="#1fae5c" strokeWidth={2.5} dot={false} />
          </LineChart>
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
            {priorityQueue.map((q, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="px-6 py-4 text-ink font-medium">{q.id}</td>
                <td className="px-6 py-4 text-body">{q.property}</td>
                <td className="px-6 py-4 text-body">{q.issue}</td>
                <td className="px-6 py-4 text-body">{q.dueDate}</td>
                <td className="px-6 py-4">
                  <span
                    className={`font-semibold text-sm ${
                      q.priority === 'High' || q.priority === 'QA Reject' ? 'text-danger' : 'text-warning'
                    }`}
                  >
                    {q.priority}
                  </span>
                </td>
                <td className="px-6 py-4 text-body">{q.assignedTo}</td>
                <td className="px-6 py-4">
                  <Button variant="navy" className="!py-2 !px-5 text-xs">{q.action}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
