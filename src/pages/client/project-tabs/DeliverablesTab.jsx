import { useEffect, useState } from 'react';
import { FileText, FileSpreadsheet, File, Download } from 'lucide-react';
import Button from '../../../components/Button';
import { supabase } from '../../../lib/supabaseClient';

const icons = { pdf: FileText, xls: FileSpreadsheet, doc: File };

export default function DeliverablesTab({ project }) {
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const projectId = project?.id;

  useEffect(() => {
    let mounted = true;

    const fetchDeliverables = async () => {
      if (!projectId) return;
      setLoading(true);
      setError(false);
      try {
        // Scoped by RLS ("clients can view own-project deliverables only") — a
        // client only ever sees deliverables of projects they own.
        const { data, error: fetchError } = await supabase
          .from('project_deliverables')
          .select('*')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true });
        if (fetchError) throw new Error(fetchError.message);

        if (mounted) {
          setDeliverables((data ?? []).map((d) => ({
            id: d.id,
            title: d.title,
            desc: d.description,
            icon: d.file_type,
            ready: d.ready,
          })));
        }
      } catch {
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchDeliverables();
    return () => {
      mounted = false;
    };
  }, [projectId]);

  return (
    <div className="mt-6">
      <h4 className="font-['Inter'] font-semibold text-[25px] leading-[36px] tracking-[-0.3px] text-[#0B1C30] mb-4">Deliverables (Available after delivery)</h4>
      {loading ? (
        <p className="text-sm text-muted py-4">Loading deliverables...</p>
      ) : error ? (
        <p className="text-sm text-muted py-4">Couldn't load deliverables.</p>
      ) : deliverables.length === 0 ? (
        <p className="text-sm text-muted py-4">No deliverables yet.</p>
      ) : (
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
      )}
    </div>
  );
}