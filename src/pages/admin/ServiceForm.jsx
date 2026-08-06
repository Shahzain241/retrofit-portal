import { useState } from 'react';
import { Upload, X, Plus, Bold, Italic, List } from 'lucide-react';
import Button from '../../components/Button';

export default function ServiceForm() {
  const [deliverables, setDeliverables] = useState([
    'On-site property inspection',
    'Basic energy efficiency report',
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Services Management</h1>
      <p className="text-body mt-1 mb-6">Add / Edit services, tiers, add-ons (demo)</p>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 space-y-6">
        <h4 className="font-bold text-ink">General Information</h4>

        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Service Title</label>
          <input
            placeholder="e.g. Comprehensive Energy Audit"
            className="w-full rounded-xl border border-line px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Description</label>
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 bg-surface px-4 py-2 border-b border-line">
              <Bold size={14} className="text-body" />
              <Italic size={14} className="text-body" />
              <List size={14} className="text-body" />
            </div>
            <textarea
              placeholder="Describe the service..."
              rows={5}
              className="w-full px-4 py-3 text-sm focus:outline-none resize-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Media</label>
          <div className="border-2 border-dashed border-line rounded-xl py-10 flex flex-col items-center justify-center text-center">
            <Upload size={22} className="text-ink mb-3" />
            <p className="font-semibold text-ink text-sm">Upload New EPC Certificate</p>
            <p className="text-xs text-muted mt-1">PDF, JPEG, or PNG up to 10MB</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-ink">Pricing Tiers</label>
            <Button variant="navy" icon={Plus} className="!py-2 !px-4 text-xs">Add Tier</Button>
          </div>
          <div className="border border-line rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[11px] font-semibold text-muted mb-1.5">TIER NAME</p>
                <input defaultValue="Standard" className="w-full rounded-lg border border-line px-3 py-2.5 text-sm" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted mb-1.5">PRICE</p>
                <input defaultValue="290" className="w-full rounded-lg border border-line px-3 py-2.5 text-sm" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-muted mb-1.5">DAYS TO COMPLETE</p>
                <input defaultValue="3" className="w-full rounded-lg border border-line px-3 py-2.5 text-sm" />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-muted mb-2">DELIVERABLES</p>
              <div className="space-y-2">
                {deliverables.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input defaultValue={d} className="flex-1 rounded-lg border border-line px-3 py-2.5 text-sm" />
                    <button
                      onClick={() => setDeliverables((arr) => arr.filter((_, idx) => idx !== i))}
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
                  className="!py-2 !px-4 text-xs"
                  onClick={() => setDeliverables((arr) => [...arr, ''])}
                >
                  Add Deliverable
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 mt-6 flex items-center justify-between">
        <div>
          <h4 className="font-bold text-ink">Service Active</h4>
          <p className="text-sm text-body mt-1">Make this service immediately available for booking upon publishing.</p>
        </div>
        <div className="w-11 h-6 rounded-full bg-navy-900 flex items-center justify-end px-0.5 shrink-0">
          <span className="w-5 h-5 rounded-full bg-white block" />
        </div>
      </div>

      <Button variant="green" className="w-full mt-6 !py-4">Save</Button>
    </div>
  );
}
