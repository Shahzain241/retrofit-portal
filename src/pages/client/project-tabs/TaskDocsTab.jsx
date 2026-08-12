import { useRef, useState } from 'react';
import { FileText, Upload, FilePenLine, Download, X, Send } from 'lucide-react';
import Button from '../../../components/Button';
import { documents as initialDocuments } from '../../../data/misc';

export default function TaskDocsTab() {
  const [documents, setDocuments] = useState(initialDocuments);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionText, setRevisionText] = useState('');
  const [feedback, setFeedback] = useState('');
  const fileInputRef = useRef(null);

  function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const added = files.map((file) => ({
      name: file.name,
      meta: `Uploaded now • ${file.size ? `${(file.size / 1024).toFixed(0)} KB` : ''}`.trim(),
    }));
    setDocuments((d) => [...d, ...added]);
    setFeedback(`Uploaded ${added.length} document${added.length > 1 ? 's' : ''}.`);
    e.target.value = '';
  }

  function submitRevision() {
    if (!revisionText.trim()) return;
    setFeedback('Revision request sent to your project team.');
    setRevisionOpen(false);
    setRevisionText('');
  }

  function downloadReport() {
    const rows = documents.map((d, i) => `${i + 1}. ${d.name} — ${d.meta}`).join('\n');
    const content = `Retrofit Portal — Documents Report\n${'='.repeat(40)}\n\n${rows}\n\nGenerated ${new Date().toLocaleString()}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documents-report-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setFeedback('Report downloaded.');
  }

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 bg-white rounded-2xl border border-line/60 shadow-sm p-6">
        <h4 className="font-['Inter'] font-semibold text-[16px] leading-[24px] tracking-[0px] text-[#0B1C30] mb-4">Your Documents</h4>
        {feedback && (
          <p className="text-xs text-brand-green font-medium mb-4">{feedback}</p>
        )}
        <div className="space-y-1">
          {documents.map((d, i) => (
            <div
              key={`${d.name}-${i}`}
              className={`flex items-center gap-3 py-4 ${i !== documents.length - 1 ? 'border-b border-dashed border-line' : ''}`}
            >
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
                <FileText size={18} className="text-ink" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{d.name}</p>
                <p className="text-xs text-muted">{d.meta}</p>
              </div>
            </div>
          ))}
          {documents.length === 0 && (
            <p className="text-sm text-muted py-4">No documents uploaded yet.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 space-y-3 h-fit">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          variant="outline"
          icon={Upload}
          className="w-full !justify-start"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Documents
        </Button>
        <Button
          variant="outline"
          icon={FilePenLine}
          className="w-full !justify-start"
          onClick={() => setRevisionOpen((open) => !open)}
        >
          Request Revision
        </Button>
        {revisionOpen && (
          <div className="border border-line rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink">Describe your revision</p>
              <button
                onClick={() => setRevisionOpen(false)}
                className="text-muted hover:text-ink"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <textarea
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
              rows={3}
              placeholder="e.g. Please update the EPC figures..."
              className="w-full rounded-xl bg-surface px-4 py-3 text-sm focus:outline-none resize-none"
            />
            <Button
              variant="primary"
              icon={Send}
              size="small"
              disabled={!revisionText.trim()}
              className="w-full"
              onClick={submitRevision}
            >
              Send Request
            </Button>
          </div>
        )}
        <Button variant="green" icon={Download} className="w-full" onClick={downloadReport}>
          Download Report
        </Button>
      </div>
    </div>
  );
}
