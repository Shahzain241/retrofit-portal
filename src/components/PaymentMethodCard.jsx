import { Plus } from 'lucide-react';
import Button from './Button';

export default function PaymentMethodCard() {
  return (
    <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
      <h4 className="font-bold text-ink mb-4">Payment Method</h4>
      <div className="border border-line rounded-xl px-4 py-3 flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="bg-navy-900 text-white text-[10px] font-bold px-2 py-1 rounded">VISA</span>
          <div>
            <p className="text-sm font-semibold text-ink">Visa •••• 4242</p>
            <p className="text-xs text-muted">Expires 12/2026</p>
          </div>
        </div>
        <button className="text-brand-green text-sm font-semibold">UPDATE</button>
      </div>
      <p className="text-xs text-muted border-t border-dashed border-line pt-4 mb-4">
        Your default payment method is used for all recurring subscription charges and project extras.
      </p>
      <Button variant="primary" icon={Plus} className="w-full">
        Add Backup Method
      </Button>
    </div>
  );
}
