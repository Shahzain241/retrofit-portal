import { useEffect, useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

const stateStyles = {
  done: 'bg-brand-green text-white',
  current: 'bg-warning text-white',
  upcoming: 'bg-line text-muted',
};

/** Format a date value (YYYY-MM-DD) as the mock displayed it: DD/MM/YYYY. */
function formatMilestoneDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export default function TimelineTab({ project }) {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const projectId = project?.id;

  useEffect(() => {
    let mounted = true;

    const fetchMilestones = async () => {
      if (!projectId) return;
      setLoading(true);
      setError(false);
      try {
        // Scoped by RLS ("clients can view own-project milestones only") — a
        // client only ever sees milestones of projects they own.
        const { data, error: fetchError } = await supabase
          .from('project_milestones')
          .select('*')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true });
        if (fetchError) throw new Error(fetchError.message);

        if (mounted) {
          setMilestones((data ?? []).map((m) => ({
            id: m.id,
            title: m.title,
            date: m.due_date ? formatMilestoneDate(m.due_date) : '',
            state: m.state,
          })));
        }
      } catch {
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchMilestones();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  return (
    <div className="mt-6">
      <h4 className="font-['Inter'] font-semibold text-[25px] leading-[36px] tracking-[-0.3px] text-[#0B1C30] mb-6">Milestone Timeline</h4>
      {loading ? (
        <p className="text-sm text-muted py-4">Loading milestones...</p>
      ) : error ? (
        <p className="text-sm text-muted py-4">Couldn't load milestones.</p>
      ) : milestones.length === 0 ? (
        <p className="text-sm text-muted py-4">No milestones yet.</p>
      ) : (
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
                <p className={`font-['Inter'] font-semibold text-[16px] leading-[24px] tracking-[0px] text-[#0B1C30] ${m.state === 'upcoming' ? '!text-muted' : ''}`}>
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
      )}
    </div>
  );
}