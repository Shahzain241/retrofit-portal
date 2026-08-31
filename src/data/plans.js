/**
 * Subscription plan catalog — the three billing tiers.
 *
 * The single source of truth for plan names + display prices: Billing.jsx
 * derives its PLAN_PRICES map from here so the two pages can't drift apart.
 * Static on purpose — plans are not admin-editable (yet); if that ever changes
 * this becomes a Supabase `plans` table and this module is replaced by a fetch.
 *
 * `cta` is the label shown when the tier is NOT the user's current plan (the
 * current card is always rendered as a disabled "Current Plan" button — see
 * Plans.jsx). So the Free tier's cta is a sign-up style action, not
 * "Current Plan".
 */

export const plans = [
  {
    id: 'plan-free',
    name: 'Free',
    price: '£0',
    desc: 'Essential tools for individuals.',
    features: [
      { id: 'free-1', text: 'Up to 2 projects', ok: true },
      { id: 'free-2', text: 'Basic PDF exports', ok: true },
      { id: 'free-3', text: 'Advanced analytics', ok: false },
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    id: 'plan-priority',
    name: 'Priority',
    price: '£29',
    desc: 'Precision tools for growing teams.',
    features: [
      { id: 'priority-1', text: 'Unlimited projects', ok: true },
      { id: 'priority-2', text: 'Priority support', ok: true },
      { id: 'priority-3', text: 'Advanced energy models', ok: true },
    ],
    cta: 'Upgrade Now',
    highlight: true,
    badge: 'MOST POPULAR',
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise',
    price: '£149',
    desc: 'Institutional-grade control.',
    features: [
      { id: 'enterprise-1', text: 'SSO & SAML', ok: true },
      { id: 'enterprise-2', text: 'Custom API access', ok: true },
      { id: 'enterprise-3', text: 'Dedicated account manager', ok: true },
    ],
    cta: 'Contact Sales',
    highlight: false,
  },
];