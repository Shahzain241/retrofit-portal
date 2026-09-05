import { useState } from 'react';
import { Check, X } from 'lucide-react';
import Button from '../../components/Button';
import Modal from '../../components/ui/Modal';
import { plans } from '../../data/plans';
import { useProfile } from '../../context/ProfileContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/Plans.css';

// Placeholder — replace with the real sales contact address.
const SALES_LINK = 'mailto:sales@retrofitportal.example';

/**
 * Billing Plans (client) — the three subscription tiers. Styled via
 * Plans.css + Tailwind utilities. The user's current plan (from profiles.plan,
 * hydrated via ProfileContext) marks the matching card with a disabled
 * CURRENT PLAN button; non-current cards run a real (simulated) switch action
 * — a confirmation modal, then profiles.plan/next_billing_date write.
 */
export default function Plans() {
  const { showToast } = useToast();
  const { profile, updateProfile } = useProfile();
  const [confirmPlan, setConfirmPlan] = useState(null);
  const [upgrading, setUpgrading] = useState(false);
  // Only the matching card is ever "current"; guard against a plan value that
  // isn't in the catalog by falling back to Free.
  const currentPlan = plans.some((p) => p.name === profile.plan) ? profile.plan : 'Free';
  const cards = plans.map((p) => ({ ...p, isCurrent: p.name === currentPlan }));

  /** YYYY-MM-DD one month from today (matches next_billing_date format). */
  function oneMonthFromToday() {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async function handleSwitchPlan() {
    if (!confirmPlan) return;
    setUpgrading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const isFree = confirmPlan === 'Free';
      const { error } = await supabase
        .from('profiles')
        .update({
          plan: confirmPlan,
          next_billing_date: isFree ? null : oneMonthFromToday(),
        })
        .eq('id', user.id);
      if (error) {
        showToast({ type: 'error', message: error.message || 'Could not switch plan.' });
        return;
      }
      updateProfile({ plan: confirmPlan, nextBillingDate: isFree ? null : oneMonthFromToday() });
      showToast({ type: 'success', message: isFree ? 'You are now on the Free plan' : `Plan upgraded to ${confirmPlan}` });
    } catch {
      showToast({ type: 'error', message: 'Could not switch plan' });
    } finally {
      setUpgrading(false);
      setConfirmPlan(null);
    }
  }
  return (
    <div>
      <h1 className="font-['Inter'] font-medium text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1E36]">Choose Your Transformation</h1>
      <p className="text-body mt-1 mb-8">Scalable solutions for teams of all sizes.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((p) => {
          const gradientCta = p.cta === 'Contact Sales';
          return (
          <div
            key={p.name}
            className={`relative rounded-2xl p-6 border ${
              p.highlight ? 'bg-navy-900 text-white border-navy-900' : 'bg-white border-line/60 shadow-sm'
            }`}
          >
            {p.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-green text-white text-[10px] font-bold px-4 py-1.5 rounded-full">
                {p.badge}
              </span>
            )}
            <h3 className={`text-lg font-bold ${p.highlight ? 'text-brand-green' : 'text-ink'}`}>{p.name}</h3>
            <p className={`text-4xl font-bold mt-2 ${p.highlight ? 'text-white' : 'text-ink'}`}>
              {p.price}
              <span className={`text-sm font-normal ${p.highlight ? 'text-white/60' : 'text-muted'}`}>/mo</span>
            </p>
            <p className={`text-sm mt-2 mb-4 ${p.highlight ? 'text-white/70' : 'text-body'}`}>{p.desc}</p>
            <div className={`space-y-2.5 pt-4 mb-6 border-t border-dashed ${p.highlight ? 'border-white/20' : 'border-line'}`}>
              {p.features.map((f) => (
                <div key={f.text} className="flex items-center gap-2 text-sm">
                  {f.ok ? (
                    <span className="w-[21px] h-[21px] rounded-full border border-brand-green flex items-center justify-center shrink-0">
                      <Check size={12} className="text-brand-green" />
                    </span>
                  ) : (
                    <span className="w-[21px] h-[21px] rounded-full border border-[#D1D5DB] flex items-center justify-center shrink-0">
                      <X size={12} className="text-[#D1D5DB]" />
                    </span>
                  )}
                  <span className={p.highlight ? 'text-white' : 'text-ink'}>
                    {f.text}
                  </span>
                </div>
              ))}
            </div>
            <Button
              variant={p.isCurrent ? 'gradient' : gradientCta ? 'gradient' : 'outline'}
              className={`w-full ${gradientCta || p.isCurrent ? 'rp-plan-card-cta' : ''} ${p.isCurrent ? 'rp-plan-current' : ''}`}
              disabled={p.isCurrent}
              onClick={() => {
                if (p.isCurrent) return;
                if (p.cta === 'Contact Sales') {
                  window.location.href = SALES_LINK;
                } else {
                  setConfirmPlan(p.name);
                }
              }}
            >
              {p.isCurrent ? 'Current Plan' : p.cta}
            </Button>
          </div>
          );
        })}
      </div>

      <Modal
        isOpen={!!confirmPlan}
        onClose={() => !upgrading && setConfirmPlan(null)}
        title={confirmPlan === 'Free' ? 'Switch to Free' : `Upgrade to ${confirmPlan || ''}`}
      >
        <p className="mb-6">
          {confirmPlan === 'Free'
            ? "Switch to the Free plan? Your next billing date will be cleared."
            : `Switch to the ${confirmPlan} plan? Your next billing date will be set to one month from today.`}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={upgrading}
            onClick={() => setConfirmPlan(null)}
          >
            Keep Current Plan
          </Button>
          <Button
            variant="navy"
            className="flex-1"
            disabled={upgrading}
            onClick={handleSwitchPlan}
          >
            {upgrading ? 'Switching...' : 'Switch Plan'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
