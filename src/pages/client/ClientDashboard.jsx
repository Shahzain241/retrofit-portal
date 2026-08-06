import { Link } from 'react-router-dom';
import { ClipboardCheck, CheckCircle2, Star, Zap, ChevronRight } from 'lucide-react';
import StatCard from '../../components/StatCard';
import Button from '../../components/Button';
import { projects } from '../../data/projects';
import { useProfile } from '../../context/ProfileContext';

export default function ClientDashboard() {
  const { profile } = useProfile();
  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 to-navy-800 text-white p-8 mb-6">
        <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full border-[20px] border-brand-green/40" />
        <div className="absolute right-16 bottom-0 w-32 h-32 rounded-full bg-brand-green/30" />
        <h1 className="text-3xl font-bold relative z-10">Good morning {profile.firstName}!</h1>
        <p className="text-white/70 mt-2 relative z-10">
          You have <span className="text-brand-green font-semibold">2 active projects</span> that
          require attention today.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
        <StatCard icon={ClipboardCheck} value="2" label="Active Projects" />
        <StatCard icon={CheckCircle2} value="4" label="Completed" />
        <StatCard icon={Star} value="£1,5054" label="Funding Secured" />
        <StatCard icon={Zap} value="100%" label="Compliance" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-ink">Your Active Projects</h2>
        <Link to="/projects" className="text-sm font-semibold text-ink flex items-center gap-1">
          View All <ChevronRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {projects.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-line/60 shadow-sm overflow-hidden">
            <div className="relative h-40">
              <img src={p.image} alt={p.address} className="w-full h-full object-cover" />
              <span className="absolute top-3 left-3 bg-brand-green-light text-brand-green text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-green" /> IN PROGRESS
              </span>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-ink text-lg">{p.address}</h3>
              <p className="text-body text-sm mt-1">{p.title}</p>

              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-body">Progress</span>
                  <span className="text-brand-green font-bold">{p.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-line overflow-hidden">
                  <div className="h-full bg-brand-green" style={{ width: `${p.progress}%` }} />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <img src={p.coordinator.avatar} className="w-8 h-8 rounded-full object-cover" />
                <div>
                  <p className="text-sm font-semibold text-ink">{p.coordinator.name}</p>
                  <p className="text-xs text-muted">{p.coordinator.role}</p>
                </div>
              </div>

              <Link to={`/projects/${p.id}`}>
                <Button variant="primary" className="w-full mt-4 !rounded-xl">
                  Open Project
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-ink">Upgrade to Priority Support</h3>
          <p className="text-body text-sm mt-1">
            Get Priority Support for £29/mo — faster responses + 15% off
          </p>
        </div>
        <Link to="/billing/plans">
          <Button variant="green">Upgrade Now</Button>
        </Link>
      </div>
    </div>
  );
}
