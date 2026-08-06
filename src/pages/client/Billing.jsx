import { Link } from 'react-router-dom';
import { CheckCircle2, Download } from 'lucide-react';
import Button from '../../components/Button';
import PaymentMethodCard from '../../components/PaymentMethodCard';
import { invoices } from '../../data/misc';
import { downloadInvoicePdf } from '../../utils/pdf';

export default function Billing() {
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Billing & Subscription</h1>
          <p className="text-body mt-1">
            Manage your organizational plan, payment methods, and billing history.
          </p>
        </div>
        <Link to="/billing/plans">
          <Button variant="navy">Upgrade Plan</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
          <span className="bg-brand-green-light text-brand-green text-xs font-bold px-3 py-1 rounded-full">
            Current Plan
          </span>
          <div className="flex items-end justify-between mt-3 mb-4">
            <h3 className="text-2xl font-bold text-ink">Priority Plan</h3>
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
          <div className="flex gap-3 border-t border-dashed border-line pt-4">
            <Button variant="outline" className="flex-1">Upgrade Plan</Button>
            <Button variant="navy" className="flex-1">Cancel</Button>
          </div>
        </div>

        <PaymentMethodCard />
      </div>

      <h3 className="text-xl font-bold text-ink mb-4">Invoice History</h3>
      <div className="bg-white rounded-2xl border border-line/60 shadow-sm overflow-hidden">
        <table className="w-full text-left">
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
                  <span className="text-brand-green font-semibold text-sm">{inv.status}</span>
                </td>
                <td className="px-6 py-4">
                  <Button
                    variant="navy"
                    icon={Download}
                    className="!py-2 !px-4 text-xs"
                    onClick={() => downloadInvoicePdf(inv, i)}
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
