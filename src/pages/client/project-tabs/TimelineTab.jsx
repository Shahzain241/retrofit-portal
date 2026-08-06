import { Check, Clock } from 'lucide-react';
import { milestones } from '../../../data/misc';

const stateStyles = {
  done: 'bg-brand-green text-white',
  current: 'bg-warning text-white',
  upcoming: 'bg-line text-muted',
};

export default function TimelineTab() {
  return (
    <div className="mt-6">
      <h4 className="font-bold text-ink mb-6">Milestone Timeline</h4>
      <div className="space-y-0">
        {milestones.map((m, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${stateStyles[m.state]}`}>
                {m.state === 'done' ? <Check size={16} /> : <Clock size={16} />}
              </div>
              {i !== milestones.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[48px] ${m.state === 'done' ? 'bg-brand-green' : 'bg-line'}`} />
              )}
            </div>
            <div className="pb-8">
              <p className={`font-bold ${m.state === 'upcoming' ? 'text-muted' : 'text-ink'}`}>
                {m.title}{' '}
                {m.state === 'current' && (
                  <span className="text-warning font-medium text-sm">(Current)</span>
                )}
              </p>
              {m.date && <p className="text-sm text-muted mt-0.5">{m.date}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
