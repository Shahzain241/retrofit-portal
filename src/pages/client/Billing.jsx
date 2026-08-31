import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Download } from 'lucide-react';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Modal from '../../components/ui/Modal';
import PaymentMethodCard from '../../components/PaymentMethodCard';
import { label, INVOICE_STATUS } from '../../data/enums';
import { plans } from '../../data/plans';
import { useToast } from '../../context/ToastContext';
import { useProfile } from '../../context/ProfileContext';
import { supabase } from '../../lib/supabaseClient';
import { downloadInvoicePdf } from '../../utils/pdf';
import '../../styles/Billing.css';

/** Plan name → display price, derived from the shared plans catalog. */
const PLAN_PRICES = Object.fromEntries(plans.map((p) => [p.name, p.price]));

/** Format a date value (YYYY-MM-DD) like the rest of the app: "Oct 12, 2024". */
function formatNextBilling(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format an invoice date for display, e.g. "Sep 12, 2024". */
function formatInvoiceDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Client Billing — current plan, payment methods and invoice history.
 * Styled via Billing.css + shared dashboard classes.
 */
export default function Billing() {
  const { showToast } = useToast();
  const { profile, updateProfile } = useProfile();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const planPrice = PLAN_PRICES[profile.plan] ?? '—';
  const nextBilling = profile.plan !== 'Free' ? formatNextBilling(profile.nextBillingDate) : null;

  useEffect(() => {
    let mounted = true;

    const fetchInvoices = async () => {
      setLoading(true);
      setError(false);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        // Scoped by RLS ("invoices owner read") — a client only ever sees
        // their own invoices; creation happens server-side (staff/billing).
        const { data, error: fetchError } = await supabase
          .from('invoices')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });
        if (fetchError) throw new Error(fetchError.message);

        if (mounted) {
          setInvoices((data ?? []).map((inv) => ({
            id: inv.id,
            number: inv.number,
            date: formatInvoiceDate(inv.date),
            amount: `£${Number(inv.amount).toFixed(2)}`,
            status: inv.status,
          })));
        }
      } catch {
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchInvoices();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleCancelPlan() {
    setCancelling(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('profiles')
        .update({ plan: 'Free', next_billing_date: null })
        .eq('id', user.id);
      if (error) {
        showToast({ type: 'error', message: error.message || 'Could not cancel plan.' });
        return;
      }
      updateProfile({ plan: 'Free', nextBillingDate: null });
      showToast({ type: 'success', message: 'Subscription cancelled — you are now on the Free plan' });
    } catch {
      showToast({ type: 'error', message: 'Could not cancel plan' });
    } finally {
      setCancelling(false);
      setCancelOpen(false);
    }
  }
  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-['Inter'] font-semibold text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1C30]">Billing & Subscription</h1>
          <p className="text-body mt-1">
            Manage your organizational plan, payment methods, and billing history.
          </p>
        </div>
        <Link to="/billing/plans">
          <Button
            variant="gradientEdge"
            className="rp-dash-cta w-[143px]"
          >
            Upgrade Plan
          </Button>
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row justify-between gap-6 mb-8">
        <div className="rp-plan-card">
          <Badge variant="green">Current Plan</Badge>
          <div className="flex flex-wrap items-end justify-between gap-3 mt-3 mb-4">
            <h3 className="font-['Inter'] font-semibold text-[24px] leading-[32px] tracking-[-0.24px] text-[#0B1C30]">{profile.plan} Plan</h3>
            <div className="text-right">
              <p className="text-3xl font-bold text-ink">
                {planPrice}<span className="text-sm text-muted font-normal">/mo</span>
              </p>
              <p className="text-xs text-muted">
                {nextBilling ? `Next billing: ${nextBilling}` : '—'}
              </p>
            </div>
          </div>
          <div className="space-y-2 mb-5">
            {['Unlimited retrofit projects', 'Advanced energy efficiency analytics', 'Team collaboration (up to 10 members)'].map(
              (f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-body">
                  <CheckCircle2 size={16} className="text-brand-green shrink-0" /> {f}
                </div>
              )
            )}
          </div>
          <div className="flex gap-3 border-t border-dashed border-line pt-4 rp-plan-actions">
            <Link to="/billing/plans" className="flex-1">
              <Button
                variant="outline"
                className="rp-plan-upgrade w-full"
              >
                Upgrade Plan
              </Button>
            </Link>
            {profile.plan !== 'Free' && (
              <Button
                variant="navy"
                className="rp-plan-cancel flex-1"
                onClick={() => setCancelOpen(true)}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        <PaymentMethodCard />
      </div>

      <h3 className="font-['Inter'] font-semibold text-[25px] leading-[36px] tracking-[-0.3px] text-[#0B1C30] mb-4">Invoice History</h3>
      <div className="bg-white rounded-2xl border border-line/60 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[480px]">
          <thead>
            <tr className="text-xs font-semibold text-muted uppercase border-b border-line">
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-sm text-muted">Loading invoices...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-sm text-muted">Couldn't load invoices.</td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-sm text-muted">No invoices yet.</td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-line/60 last:border-0">
                  <td className="px-6 py-4 text-ink">{inv.date}</td>
                  <td className="px-6 py-4 text-ink">{inv.amount}</td>
                  <td className="px-6 py-4">
                    <span className="text-brand-green font-semibold text-sm">{label(INVOICE_STATUS, inv.status)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Button
                      variant="gradient"
                      icon={Download}
                      className="rp-table-btn-pdf !py-2 !px-4 text-xs"
                      onClick={() => {
                        downloadInvoicePdf(inv);
                        showToast({ type: 'success', message: 'Invoice downloaded' });
                      }}
                    >
                      PDF
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={cancelOpen}
        onClose={() => !cancelling && setCancelOpen(false)}
        title="Cancel Subscription"
      >
        <p className="mb-6">
          Cancel your {profile.plan} plan? You'll be moved to the Free plan and
          your next billing date will be cleared.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={cancelling}
            onClick={() => setCancelOpen(false)}
          >
            Keep Plan
          </Button>
          <Button
            variant="navy"
            className="flex-1"
            disabled={cancelling}
            onClick={handleCancelPlan}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Plan'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
