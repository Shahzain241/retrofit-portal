import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { useToast } from '../../../context/ToastContext';

const POLL_MS = 8000;

// No avatar column on profiles — neutral placeholder (same as other pages).
const PLACEHOLDER_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#e6e9ef"/><circle cx="32" cy="24" r="11" fill="#98a2b3"/><path d="M12 56c2-10 11-15 20-15s18 5 20 15z" fill="#98a2b3"/></svg>`,
  );

/** Format a timestamp to the current display style, e.g. "14:22". */
function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function CommunicationTab({ project }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { showToast } = useToast();

  const projectId = project?.id;

  useEffect(() => {
    let cancelled = false;
    let interval;

    const load = async (userId) => {
      if (!projectId) return;
      try {
        const { data, error: fetchError } = await supabase
          .from('project_messages')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true });
        if (fetchError) throw new Error(fetchError.message);
        if (!cancelled) {
          setMessages((data ?? []).map((m) => ({
            id: m.id,
            from: m.sender_id === userId ? 'me' : 'other',
            text: m.body,
            type: m.type ?? 'message',
            time: formatTime(m.created_at),
            avatar: PLACEHOLDER_AVATAR,
          })));
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await load(user?.id ?? null);
      interval = setInterval(() => load(user?.id ?? null), POLL_MS);
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [projectId, refreshKey]);

  async function send() {
    if (!text.trim()) {
      showToast({ type: 'error', message: 'Type a message before sending' });
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      showToast({ type: 'error', message: 'Not signed in' });
      return;
    }

    const { error: insertError } = await supabase.from('project_messages').insert({
      project_id: projectId,
      sender_id: user.id,
      body: text.trim(),
    });
    if (insertError) {
      showToast({ type: 'error', message: insertError.message || 'Could not send the message.' });
      return;
    }

    setText('');
    showToast({ type: 'success', message: 'Message sent' });
    // Immediate refetch so the sent message appears right away (don't wait for the poll).
    setRefreshKey((k) => k + 1);
    // Keep the Project Detail tab badge in sync with the thread.
    window.dispatchEvent(new Event('rp:messages-changed'));
  }

  return (
    <div className="mt-6">
      <h4 className="font-bold text-ink mb-4">Project Chat</h4>
      <div className="bg-white rounded-2xl border border-line/60 shadow-sm flex flex-col h-[480px]">
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted">Loading messages...</p>
          ) : error ? (
            <p className="text-sm text-muted">Couldn't load messages.</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted">No messages yet.</p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`flex items-end gap-3 ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                {m.from === 'other' && (
                  <img src={m.avatar} alt="Contact avatar" className="w-8 h-8 rounded-full object-cover" />
                )}
                <div
                  className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${
                    m.from === 'me' ? 'bg-navy-900 text-white' : 'bg-surface text-ink'
                  }`}
                >
                  {m.type === 'revision_request' && (
                    <span className="inline-block mb-1 bg-brand-green-light text-brand-green text-[9px] font-bold uppercase px-2 py-0.5 rounded-full">
                      Revision Request
                    </span>
                  )}
                  <p>{m.text}</p>
                  <p className={`text-[10px] mt-1 ${m.from === 'me' ? 'text-white/60' : 'text-muted'}`}>
                    • {m.time}
                  </p>
                </div>
                {m.from === 'me' && (
                  <img src={m.avatar} alt="Your avatar" className="w-8 h-8 rounded-full object-cover" />
                )}
              </div>
            ))
          )}
        </div>
        <div className="p-4 border-t border-line flex items-center gap-3">
          <label htmlFor="chat-message-input" className="sr-only">Type your message</label>
          <input
            id="chat-message-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Type your message..."
            className="flex-1 rounded-full bg-surface px-5 py-3 text-sm focus:outline-none"
          />
          <button
            onClick={send}
            aria-label="Send message"
            className="w-11 h-11 rounded-full bg-navy-900 text-white flex items-center justify-center shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}