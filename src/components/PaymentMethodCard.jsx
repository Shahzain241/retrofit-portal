import { useCallback, useEffect, useState } from 'react';
import { Plus, CreditCard } from 'lucide-react';
import Button from './Button';
import Modal from './ui/Modal';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabaseClient';
import '../styles/PaymentMethodCard.css';

/**
 * Payment method panel shown on the Billing page — renders the logged-in
 * client's real `payment_methods` rows (SIMULATED cards: brand + last 4 only,
 * no real numbers — there is no payment processor in this app). Scoped to the
 * owner by RLS (user_id = auth.uid()).
 *
 *   - UPDATE  — upserts the client's primary row (is_backup = false): updates
 *               it if one exists, inserts it otherwise.
 *   - Add Backup Method — inserts a second row with is_backup = true.
 */
export default function PaymentMethodCard() {
  const { showToast } = useToast();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState('primary'); // 'primary' | 'backup'
  const [brand, setBrand] = useState('');
  const [last4, setLast4] = useState('');
  const [saving, setSaving] = useState(false);

  const primary = cards.find((c) => !c.is_backup) ?? null;
  const backups = cards.filter((c) => c.is_backup);

  const loadCards = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[PaymentMethodCard] failed to load payment methods', error.message, error);
      setLoading(false);
      return;
    }
    setCards(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  function openModal(nextMode) {
    setMode(nextMode);
    if (nextMode === 'primary' && primary) {
      setBrand(primary.card_brand);
      setLast4(primary.last4);
    } else {
      setBrand('');
      setLast4('');
    }
    setModalOpen(true);
  }

  function handleClose() {
    if (saving) return;
    setModalOpen(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    const cardBrand = brand.trim();
    const cardLast4 = last4.trim();
    if (!cardBrand) {
      showToast({ type: 'error', message: 'Please enter a card brand.' });
      return;
    }
    if (!/^\d{4}$/.test(cardLast4)) {
      showToast({ type: 'error', message: 'Last 4 digits must be exactly 4 digits.' });
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('You need to be signed in to save a payment method.');

      if (mode === 'primary') {
        // Upsert the primary row: update when one exists, otherwise insert.
        if (primary) {
          const { error } = await supabase
            .from('payment_methods')
            .update({ card_brand: cardBrand, last4: cardLast4 })
            .eq('id', primary.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('payment_methods')
            .insert({ user_id: user.id, card_brand: cardBrand, last4: cardLast4, is_backup: false });
          if (error) throw error;
        }
        showToast({ type: 'success', message: 'Payment method updated' });
      } else {
        const { error } = await supabase
          .from('payment_methods')
          .insert({ user_id: user.id, card_brand: cardBrand, last4: cardLast4, is_backup: true });
        if (error) throw error;
        showToast({ type: 'success', message: 'Backup payment method added' });
      }

      setModalOpen(false);
      setBrand('');
      setLast4('');
      await loadCards();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Could not save payment method.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rp-pay-card">
      <h4 className="font-['Inter'] font-semibold text-[20px] leading-[28px] tracking-[0px] text-[#0B1C30] mb-4">Payment Method</h4>

      {loading ? (
        <p className="text-xs text-muted mb-4">Loading payment methods...</p>
      ) : (
        <>
          <div className="border border-line rounded-xl px-4 py-3 flex items-center justify-between mb-4">
            {primary ? (
              <div className="flex items-center gap-3">
                <span className="bg-navy-900 text-white text-[10px] font-bold px-2 py-1 rounded">
                  {primary.card_brand.toUpperCase().slice(0, 5)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{primary.card_brand} •••• {primary.last4}</p>
                  <p className="text-xs text-muted">Primary payment method</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="bg-surface text-muted text-[10px] font-bold px-2 py-1 rounded">
                  <CreditCard size={14} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">No payment method on file</p>
                  <p className="text-xs text-muted">Add a primary card to get started</p>
                </div>
              </div>
            )}
            <button
              className="text-brand-green text-sm font-semibold"
              onClick={() => openModal('primary')}
            >
              {primary ? 'UPDATE' : 'ADD CARD'}
            </button>
          </div>

          {backups.length > 0 && (
            <div className="mb-4 space-y-2">
              {backups.map((c) => (
                <div
                  key={c.id}
                  className="border border-line rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="bg-navy-900 text-white text-[10px] font-bold px-2 py-1 rounded">
                      {c.card_brand.toUpperCase().slice(0, 5)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{c.card_brand} •••• {c.last4}</p>
                      <p className="text-xs text-muted">Backup payment method</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted border-t border-dashed border-line pt-4 mb-4">
            Your default payment method is used for all recurring subscription charges and project extras.
          </p>
          <Button
            variant="primary"
            icon={Plus}
            className="w-full rp-pay-add"
            onClick={() => openModal('backup')}
          >
            Add Backup Method
          </Button>
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={handleClose}
        title={mode === 'primary' ? 'Update Payment Method' : 'Add Backup Payment Method'}
      >
        <form onSubmit={handleSave}>
          <p className="text-sm text-body mb-4">
            Enter a simulated card for {mode === 'primary' ? 'your primary payment method' : 'a backup payment method'}.
            Only the brand and last 4 digits are stored — never a real card number.
          </p>
          <div className="mb-4">
            <label htmlFor="pay-card-brand" className="block text-xs font-semibold text-ink mb-2">Card Brand</label>
            <input
              id="pay-card-brand"
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Visa"
              autoFocus
              className="w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="pay-card-last4" className="block text-xs font-semibold text-ink mb-2">Last 4 Digits</label>
            <input
              id="pay-card-last4"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 4242"
              className="w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={saving}
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="navy"
              className="flex-1"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Card'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}