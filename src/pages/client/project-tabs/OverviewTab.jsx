import { AlertCircle, ShieldCheck } from 'lucide-react';

const activity = [
  { title: 'Technical Survey Uploaded', meta: 'Mike Ross • 2h ago' },
  { title: 'Comment on Invoice #902', meta: 'Sarah Jenkins • 5h ago' },
  { title: 'Comment on Invoice #902', meta: 'Sarah Jenkins • 5h ago' },
];

export default function OverviewTab({ project }) {
  return (
    <div className="mt-6 space-y-6">
      <div>
        <p className="text-sm text-muted mb-1">Current Phase</p>
        <h3 className="text-2xl font-bold text-ink mb-3">{project.currentPhase}</h3>
        <p className="text-body max-w-3xl">{project.phaseDescription}</p>
      </div>

      {project.notice && (
        <div className="bg-surface rounded-2xl px-5 py-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-brand-green" />
          <span className="text-brand-green font-medium text-sm">{project.notice}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
        <h4 className="font-bold text-ink mb-4">Recent Activity</h4>
        <div className="space-y-4">
          {activity.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 ${i !== activity.length - 1 ? 'pb-4 border-b border-dashed border-line' : ''}`}
            >
              <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center shrink-0">
                <ShieldCheck size={16} className="text-ink" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{a.title}</p>
                <p className="text-xs text-muted">{a.meta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
