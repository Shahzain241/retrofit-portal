import { useState } from 'react';
import { Send } from 'lucide-react';
import { chatMessages } from '../../../data/misc';
import { useToast } from '../../../context/ToastContext';

export default function CommunicationTab() {
  const [messages, setMessages] = useState(chatMessages);
  const [text, setText] = useState('');
  const { showToast } = useToast();

  function send() {
    if (!text.trim()) {
      showToast({ type: 'error', message: 'Type a message before sending' });
      return;
    }
    setMessages((m) => [
      ...m,
      { from: 'me', text, time: 'now', avatar: 'https://i.pravatar.cc/80?img=13' },
    ]);
    setText('');
    showToast({ type: 'success', message: 'Message sent' });
  }

  return (
    <div className="mt-6">
      <h4 className="font-bold text-ink mb-4">Project Chat</h4>
      <div className="bg-white rounded-2xl border border-line/60 shadow-sm flex flex-col h-[480px]">
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          {messages.map((m, i) => (
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
                <p>{m.text}</p>
                <p className={`text-[10px] mt-1 ${m.from === 'me' ? 'text-white/60' : 'text-muted'}`}>
                  • {m.time}
                </p>
              </div>
              {m.from === 'me' && (
                <img src={m.avatar} alt="Your avatar" className="w-8 h-8 rounded-full object-cover" />
              )}
            </div>
          ))}
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
