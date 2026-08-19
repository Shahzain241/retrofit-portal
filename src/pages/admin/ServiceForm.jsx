import { useState } from 'react';
import { Upload, X, Plus, Bold, Italic, List } from 'lucide-react';
import Button from '../../components/Button';
import { useToast } from '../../context/ToastContext';
import '../../styles/ServiceForm.css';

export default function ServiceForm() {
  const [deliverables, setDeliverables] = useState([
    'On-site property inspection',
    'Basic energy efficiency report',
  ]);
  const { showToast } = useToast();

  return (
    <div>
      <h1 className="font-['Inter'] font-semibold text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1C30]">Services Management</h1>
      <p className="text-body mt-1 mb-6">Add / Edit services, tiers, add-ons (demo)</p>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 space-y-6">
        <h4 className="font-['Inter'] sf-section-title">
          General Information
        </h4>

        <div>
          <label
            htmlFor="service-title"
            className="block font-['Inter'] mb-2 sf-label"
          >
            Service Title
          </label>
          <input
            id="service-title"
            placeholder="e.g. Comprehensive Energy Audit"
            className="w-full rounded-xl border border-line px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="service-description"
            className="block font-['Inter'] mb-2 sf-label"
          >
            Description
          </label>
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 bg-surface px-4 py-2 border-b border-line">
              <Bold size={14} className="text-body" />
              <Italic size={14} className="text-body" />
              <List size={14} className="text-body" />
            </div>
            <textarea
              id="service-description"
              placeholder="Describe the service..."
              rows={5}
              className="w-full px-4 py-3 text-sm focus:outline-none resize-none"
            />
          </div>
        </div>

        <div>
          <label
            className="block font-['Inter'] mb-2 sf-label"
          >
            Media
          </label>
          <div className="border-2 border-dashed border-line rounded-xl py-10 flex flex-col items-center justify-center text-center">
            <Upload size={22} className="text-ink mb-3" />
            <p className="font-semibold text-ink text-sm">Upload New EPC Certificate</p>
            <p className="text-xs text-muted mt-1">PDF, JPEG, or PNG up to 10MB</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label
              className="block font-['Inter'] sf-label"
            >
              Pricing Tiers
            </label>
            <Button
              variant="navy"
              icon={Plus}
              className="sf-mini-btn sf-btn-add-tier"
            >
              Add Tier
            </Button>
          </div>
          <div className="border border-line rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="tier-name" className="block text-[11px] font-semibold text-muted mb-1.5">TIER NAME</label>
                <input id="tier-name" defaultValue="Standard" className="w-full rounded-lg border border-line px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label htmlFor="tier-price" className="block text-[11px] font-semibold text-muted mb-1.5">PRICE</label>
                <input id="tier-price" defaultValue="290" className="w-full rounded-lg border border-line px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label htmlFor="tier-days" className="block text-[11px] font-semibold text-muted mb-1.5">DAYS TO COMPLETE</label>
                <input id="tier-days" defaultValue="3" className="w-full rounded-lg border border-line px-3 py-2.5 text-sm" />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-muted mb-2">DELIVERABLES</p>
              <div className="space-y-2">
                {deliverables.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input aria-label={`Deliverable ${i + 1}`} defaultValue={d} className="flex-1 rounded-lg border border-line px-3 py-2.5 text-sm" />
                    <button
                      onClick={() => setDeliverables((arr) => arr.filter((_, idx) => idx !== i))}
                      aria-label={`Remove deliverable ${i + 1}`}
                      className="text-muted"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-3">
                <Button
                  variant="navy"
                  icon={Plus}
                  className="sf-mini-btn sf-btn-add-deliverable"
                  onClick={() => setDeliverables((arr) => [...arr, ''])}
                >
                  Add Deliverable
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-5 sm:p-6 mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-['Inter'] sf-service-active-title">
            Service Active
          </h4>
          <p className="text-sm text-body mt-1">Make this service immediately available for booking upon publishing.</p>
        </div>
        <div className="w-11 h-6 rounded-full bg-navy-900 flex items-center justify-end px-0.5 shrink-0">
          <span className="w-5 h-5 rounded-full bg-white block" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mt-6">
        <Button
          variant="green"
          className="sf-save-btn"
          onClick={() => showToast({ type: 'success', message: 'Service saved' })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
