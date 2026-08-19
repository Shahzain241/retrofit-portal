import { Link } from 'react-router-dom';
import { CheckCircle2, Download } from 'lucide-react';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import PaymentMethodCard from '../../components/PaymentMethodCard';
import { invoices } from '../../data/misc';
import { label, INVOICE_STATUS } from '../../data/enums';
import { useToast } from '../../context/ToastContext';
import { downloadInvoicePdf } from '../../utils/pdf';
import '../../styles/Billing.css';

/**
 * Client Billing — current plan, payment methods and invoice history.
 * Styled via Billing.css + shared dashboard classes.
 */
export default function Billing() {
  const { showToast } = useToast();
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
            <h3 className="font-['Inter'] font-semibold text-[24px] leading-[32px] tracking-[-0.24px] text-[#0B1C30]">Priority Plan</h3>
            <div className="text-right">
              <p className="text-3xl font-bold text-ink">
                £29<span className="text-sm text-muted font-normal">/mo</span>
              </p>
              <p className="text-xs text-muted">Next billing: Oct 12, 2024</p>
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
            <Button
              variant="outline"
              className="rp-plan-upgrade"
            >
              Upgrade Plan
            </Button>
            <Button
              variant="navy"
              className="rp-plan-cancel"
            >
              Cancel
            </Button>
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
            {invoices.map((inv, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
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
                      downloadInvoicePdf(inv, i);
                      showToast({ type: 'success', message: 'Invoice downloaded' });
                    }}
                  >
                    PDF
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
