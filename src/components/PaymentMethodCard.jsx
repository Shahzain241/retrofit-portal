import { Plus } from 'lucide-react';
import Button from './Button';
import { useToast } from '../context/ToastContext';
import '../styles/PaymentMethodCard.css';

/**
 * Payment method panel shown on the Billing page — current default card plus
 * an "Add Backup Method" CTA. Styled via styles/PaymentMethodCard.css.
 */
export default function PaymentMethodCard() {
  const { showToast } = useToast();
  return (
    <div className="rp-pay-card">
      <h4 className="font-['Inter'] font-semibold text-[20px] leading-[28px] tracking-[0px] text-[#0B1C30] mb-4">Payment Method</h4>
      <div className="border border-line rounded-xl px-4 py-3 flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="bg-navy-900 text-white text-[10px] font-bold px-2 py-1 rounded">VISA</span>
          <div>
            <p className="text-sm font-semibold text-ink">Visa •••• 4242</p>
            <p className="text-xs text-muted">Expires 12/2026</p>
          </div>
        </div>
        <button
          className="text-brand-green text-sm font-semibold"
          onClick={() => showToast({ type: 'success', message: 'Payment method updated' })}
        >
          UPDATE
        </button>
      </div>
      <p className="text-xs text-muted border-t border-dashed border-line pt-4 mb-4">
        Your default payment method is used for all recurring subscription charges and project extras.
      </p>
      <Button
        variant="primary"
        icon={Plus}
        className="w-full rp-pay-add"
        onClick={() => showToast({ type: 'success', message: 'Backup payment method added' })}
      >
        Add Backup Method
      </Button>
    </div>
  );
}