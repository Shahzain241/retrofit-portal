import { useEffect, useState } from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import '../../../styles/OverviewTab.css';

/**
 * Project Overview tab — current phase, "attention" notice and a REAL recent
 * activity feed (no mock data). The feed aggregates the most recent rows from
 * project_messages (sender name via profiles) and project_documents (uploader
 * name via profiles), each with its real timestamp rendered as relative time.
 * Milestones are intentionally excluded because they carry no completion
 * timestamp column (only due_date), so there is no honest "when" for them.
 */
function formatRelativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function displayName(person) {
  if (person?.full_name) return person.full_name;
  if (person?.email) return person.email.split('@')[0];
  return 'Team member';
}

export default function OverviewTab({ project }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project?.id) return undefined;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const projectId = project.id;
        const [messages, docs] = await Promise.all([
          supabase
            .from('project_messages')
            .select('id, body, type, sender_id, created_at, profiles(full_name, email)')
            .eq('project_id', projectId)
            .limit(20),
          supabase
            .from('project_documents')
            .select('id, file_name, uploaded_by, uploaded_at, profiles(full_name, email)')
            .eq('project_id', projectId)
            .limit(20),
        ]);

        const items = [];
        for (const m of messages.data ?? []) {
          items.push({
            id: `msg-${m.id}`,
            title: m.type === 'revision_request' ? 'Revision requested' : 'New message',
            meta: `${displayName(m.profiles)} • ${formatRelativeTime(m.created_at)}`,
            timestamp: m.created_at,
          });
        }
        for (const d of docs.data ?? []) {
          items.push({
            id: `doc-${d.id}`,
            title: `Document uploaded: ${d.file_name}`,
            meta: `${displayName(d.profiles)} • ${formatRelativeTime(d.uploaded_at)}`,
            timestamp: d.uploaded_at,
          });
        }

        items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        if (mounted) setActivity(items.slice(0, 6));
      } catch {
        if (mounted) setActivity([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [project?.id]);

  return (
    <div className="mt-6 space-y-6">
      <div>
        <p className="text-sm text-muted mb-1">Current Phase</p>
        {project.currentPhase && project.currentPhase !== '—' ? (
          <>
            <h3 className="text-2xl font-bold text-ink mb-3">{project.currentPhase}</h3>
            {project.phaseDescription && project.phaseDescription !== '—' && (
              <p className="text-body max-w-3xl">{project.phaseDescription}</p>
            )}
          </>
        ) : (
          <p className="text-body text-muted">No current phase set yet.</p>
        )}
      </div>

      {project.notice && (
        <div className="rp-notice-banner">
          <AlertCircle size={18} className="text-brand-green" />
          <span>{project.notice}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
        <h4 className="font-['Inter'] font-semibold text-[16px] leading-[24px] tracking-[0px] text-[#0B1C30] mb-4">Recent Activity</h4>
        {loading ? (
          <p className="text-sm text-muted py-4">Loading activity...</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-muted py-4">No recent activity yet.</p>
        ) : (
          <div className="space-y-4">
            {activity.map((a, i) => (
              <div
                key={a.id}
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
        )}
      </div>
    </div>
  );
}