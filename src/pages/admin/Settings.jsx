import { useState } from 'react';
import { Bold, Italic, List } from 'lucide-react';
import Button from '../../components/Button';
import { useProfile } from '../../context/ProfileContext';

export default function Settings() {
  const { settings, updateSettings } = useProfile();
  const [template, setTemplate] = useState(settings.emailTemplate);
  const [integrations, setIntegrations] = useState(settings.integrations);
  const [saved, setSaved] = useState(false);
  const [discarded, setDiscarded] = useState(false);

  function flash(msgKey) {
    if (msgKey === 'saved') {
      setSaved(true);
      setDiscarded(false);
      window.setTimeout(() => setSaved(false), 2000);
    } else {
      setDiscarded(true);
      setSaved(false);
      window.setTimeout(() => setDiscarded(false), 2000);
    }
  }

  function save() {
    updateSettings({ emailTemplate: template, integrations });
    flash('saved');
  }

  function discard() {
    setTemplate(settings.emailTemplate);
    setIntegrations(settings.integrations);
    flash('discarded');
  }

  function toggleIntegration(index) {
    setIntegrations((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              connected: !it.connected,
              status: !it.connected ? 'Connected' : 'Disconnected',
              meta: !it.connected ? 'Last ping: just now' : 'Paused by admin',
            }
          : it,
      ),
    );
  }

  const previewBody = template.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Platform Settings</h1>
      <p className="text-body mt-1 mb-6 max-w-2xl">
        Manage core operational parameters, security protocols, and integration health metrics
        across the enterprise environment.
      </p>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 mb-6">
        <h4 className="font-bold text-ink mb-4">Integration Health</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {integrations.map((it, i) => (
            <div key={it.name} className="border border-line rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-ink text-sm">{it.name}</p>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                    it.connected
                      ? 'bg-brand-green-light text-brand-green'
                      : 'bg-line text-muted'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${it.connected ? 'bg-brand-green' : 'bg-muted'}`}
                  />
                  {it.status}
                </span>
              </div>
              <p className="text-xs text-muted mb-3">{it.meta}</p>
              <Button
                variant={it.connected ? 'outline' : 'green'}
                className="mt-auto !py-2 text-xs"
                onClick={() => toggleIntegration(i)}
              >
                {it.connected ? 'Disconnect' : 'Connect'}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 mb-6">
        <h4 className="font-bold text-ink mb-4">Email Template</h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 bg-surface px-4 py-2 border-b border-line">
              <Bold size={14} className="text-body" />
              <Italic size={14} className="text-body" />
              <List size={14} className="text-body" />
            </div>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={10}
              className="w-full px-4 py-3 text-sm font-mono focus:outline-none resize-none"
            />
            <div className="flex justify-end p-3">
              <Button variant="green" className="!py-2 !px-6 text-sm" onClick={save}>
                Update
              </Button>
            </div>
          </div>
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="bg-navy-900 text-white px-4 py-3 font-semibold text-sm">Preview</div>
            <div className="p-5 text-sm text-body space-y-3">
              <p>Hello Jane Doe,</p>
              <p>{previewBody}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="outline" className="flex-1" onClick={discard}>
          Discard Changes
        </Button>
        <Button variant="green" className="flex-1" onClick={save}>
          Save
        </Button>
        {saved && <span className="text-sm font-semibold text-brand-green">Saved!</span>}
        {discarded && <span className="text-sm font-semibold text-body">Changes reverted</span>}
      </div>
    </div>
  );
}
