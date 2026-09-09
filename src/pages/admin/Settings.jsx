import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Button from '../../components/Button';
import { useProfile } from '../../context/ProfileContext';
import { useToast } from '../../context/ToastContext';
import { previewEmailHtml } from '../../utils/emailPreview';
import '../../styles/Settings.css';

/**
 * Admin Platform Settings — integration health, email template editor and
 * save/discard. Styled via Settings.css + shared dashboard classes.
 */
export default function Settings() {
  const { settings, updateSettings } = useProfile();
  const { showToast } = useToast();
  const [template, setTemplate] = useState(settings.emailTemplate);
  const [integrations, setIntegrations] = useState(settings.integrations);
  const [saved, setSaved] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(true);

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
    showToast({ type: 'success', message: 'Settings saved' });
  }

  function discard() {
    setTemplate(settings.emailTemplate);
    setIntegrations(settings.integrations);
    flash('discarded');
    showToast({ type: 'info', message: 'Changes discarded' });
  }

  return (
    <div>
      <h1 className="st-heading">
        Platform Settings
      </h1>
      <p className="st-sub">
        Manage core operational parameters, security protocols, and integration health metrics
        across the enterprise environment.
      </p>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 mt-10 mb-6">
        <h4 className="st-section-title mb-4">
          Integration Health
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {integrations.map((it) => (
            <div key={it.name} className="border border-line rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="st-integration-name">
                  {it.name}
                </p>
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
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 mb-6">
        <h4 className="st-section-title mb-4">
          Email Template
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 bg-surface px-4 py-2 border-b border-line">
              <button
                type="button"
                onClick={() => setTemplateOpen((v) => !v)}
                className="rp-collapse-toggle"
                aria-label={templateOpen ? 'Collapse template editor' : 'Expand template editor'}
              >
                {templateOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>
            {templateOpen && (
              <>
                <label htmlFor="email-template-editor" className="sr-only">Email template</label>
                <textarea
                  id="email-template-editor"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 text-sm font-mono focus:outline-none resize-none"
                />
                <div className="flex items-center justify-end gap-2 p-3">
                  <Button
                    variant="green"
                    className="rp-update-btn shrink-0"
                    onClick={save}
                  >
                    Update
                  </Button>
                </div>
              </>
            )}
          </div>
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="st-preview-head bg-navy-900 px-4 py-3">
              Preview
            </div>
            {/* Render the substituted template HTML. Merge tags are replaced
                with sample values (see utils/emailPreview.js) and the HTML is
                parsed into a clean, formatted preview. The stored/raw template
                is never modified. */}
            <div
              className="st-email-preview"
              dangerouslySetInnerHTML={{ __html: previewEmailHtml(template) }}
            />
          </div>
        </div>
      </div>

      <div className="rp-dash-actions-bar flex mx-auto mt-6">
        <Button
          variant="outline"
          className="flex-1 rp-dash-action rp-dash-action-cancel"
          onClick={discard}
        >
          Discard Changes
        </Button>
        <Button
          variant="green"
          className="flex-1 rp-dash-action rp-dash-action-save"
          onClick={save}
        >
          Save
        </Button>
        {saved && <span className="text-sm font-semibold text-brand-green">Saved!</span>}
        {discarded && <span className="text-sm font-semibold text-body">Changes reverted</span>}
      </div>
    </div>
  );
}