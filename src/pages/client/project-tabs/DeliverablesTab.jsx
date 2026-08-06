import { FileText, FileSpreadsheet, File, Download } from 'lucide-react';
import Button from '../../../components/Button';
import { deliverables } from '../../../data/misc';

const icons = { pdf: FileText, xls: FileSpreadsheet, doc: File };

export default function DeliverablesTab() {
  return (
    <div className="mt-6">
      <h4 className="font-bold text-ink mb-4">Deliverables (Available after delivery)</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {deliverables.map((d, i) => {
          const Icon = icons[d.icon];
          return (
            <div key={i} className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center mb-4">
                <Icon size={18} className="text-ink" />
              </div>
              <h5 className="font-bold text-ink">{d.title}</h5>
              <p className="text-sm text-body mt-1 mb-5">{d.desc}</p>
              <Button
                variant="green"
                icon={Download}
                disabled={!d.ready}
                className="w-full !bg-brand-green disabled:!bg-brand-green/50"
              >
                Download Report
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
