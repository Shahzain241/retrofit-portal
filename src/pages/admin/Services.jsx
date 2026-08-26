import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Button from '../../components/Button';
import Modal from '../../components/ui/Modal';
import StatusPill from '../../components/StatusPill';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabaseClient';
import { label, SERVICE_STATUS } from '../../data/enums';
import '../../styles/Services.css';

function formatUpdatedAt(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toViewModel(s) {
  return {
    ...s,
    days: s.working_days,
    updated: formatUpdatedAt(s.updated_at),
    deliverables: s.deliverables ?? 0,
  };
}

/**
 * Admin Services Management — catalogue with create, edit and delete.
 * Styled via Services.css + shared dashboard classes.
 */
export default function Services() {
  const { showToast } = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('services')
        .select('*')
        .order('updated_at', { ascending: false });
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setServices((data ?? []).map(toViewModel));
      }
    } catch (err) {
      setError(err?.message || 'Could not load services.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('services')
        .delete()
        .eq('id', deleteTarget.id);
      if (deleteError) {
        showToast({ type: 'error', message: deleteError.message || 'Could not delete the service.' });
        return;
      }
      setServices((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      showToast({ type: 'success', message: 'Service deleted' });
    } catch (err) {
      showToast({ type: 'error', message: err?.message || 'Could not delete the service.' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-['Inter'] font-semibold text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1C30]">Services Management</h1>
          <p className="text-body mt-1">Add / Edit services, tiers, add-ons (demo)</p>
        </div>
        <Link to="/admin/services/new" className="shrink-0">
          <Button
            variant="gradientEdge"
            icon={Plus}
            className="rp-dash-cta rp-create-service-btn"
          >
            Create Service
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="border-b border-line">
              <th className="px-6 py-4 rp-table-th">Service Title</th>
              <th className="px-6 py-4 rp-table-th">Price</th>
              <th className="px-6 py-4 rp-table-th">Working Days</th>
              <th className="px-6 py-4 rp-table-th">Last Updated</th>
              <th className="px-6 py-4 rp-table-th">Deliverables</th>
              <th className="px-6 py-4 rp-table-th">Service Status</th>
              <th className="px-6 py-4 rp-table-th">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-6 py-4 text-body" colSpan={7}>Loading services...</td>
              </tr>
            ) : error ? (
              <tr>
                <td className="px-6 py-4 text-body" colSpan={7}>Could not load services.</td>
              </tr>
            ) : services.length === 0 ? (
              <tr>
                <td className="px-6 py-4 text-body" colSpan={7}>No services yet. Click "Create Service" to add one.</td>
              </tr>
            ) : (
              services.map((s) => (
                <tr key={s.id} className="border-b border-line/60 last:border-0">
                  <td className="px-6 py-4">
                    <span className="rp-table-td">
                      {s.title}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-body">{s.price}</td>
                  <td className="px-6 py-4 text-body">{s.days}</td>
                  <td className="px-6 py-4 text-body">{s.updated}</td>
                  <td className="px-6 py-4 text-body">{s.deliverables}</td>
                  <td className="px-6 py-4">
                    <StatusPill>{label(SERVICE_STATUS, s.status)}</StatusPill>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 text-muted">
                      <Link
                        to={`/admin/services/${s.id}/edit`}
                        state={{ service: s }}
                        aria-label={`Edit ${s.title}`}
                        className="cursor-pointer hover:text-ink"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete ${s.title}`}
                        className="cursor-pointer hover:text-danger"
                        onClick={() => setDeleteTarget(s)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete Service"
      >
        <p className="mb-6">
          Delete "{deleteTarget?.title}"? This action cannot be undone.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={deleting}
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>
          <Button
            variant="green"
            className="flex-1"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}