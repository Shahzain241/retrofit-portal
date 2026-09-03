import { Link } from 'react-router-dom';
import Button from './Button';
import { plans } from '../data/plans';
import '../styles/ClientDashboard.css';

/**
 * UpgradeBanner — "Upgrade to Priority Support" upsell panel shown below the
 * active-project grid. Rendered only for users who are not already on the
 * Priority tier (see ClientDashboard, which gates this component on
 * `profile.plan`). Styling lives in ClientDashboard.css (.rp-upgrade-banner).
 *
 * The price is read from the real Priority tier in src/data/plans.js so the
 * banner can never drift from the billing catalog. Note: the Figma copy said
 * "£39/mo", but the catalog's Priority tier is £29/mo — the catalog is
 * authoritative, so the banner shows £29 and the mismatch is flagged rather
 * than hardcoding a fake price.
 */
export default function UpgradeBanner() {
  const priority = plans.find((p) => p.id === 'plan-priority');
  const price = priority?.price || '£29';

  return (
    <div className="rp-upgrade-banner border border-line rounded-xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <h3 className="font-['Inter'] font-bold text-[20px] leading-[28px] tracking-[0px] text-[#0B1C30]">
          Upgrade to Priority Support
        </h3>
        <p className="text-sm mt-1 text-[#6B7280]">
          Get Priority Support for {price}/mo — faster responses + 15% off
        </p>
      </div>
      <Link to="/billing/plans" className="w-full sm:w-auto">
        <Button variant="green" className="w-full sm:w-auto rp-upgrade-btn">
          Upgrade Now
        </Button>
      </Link>
    </div>
  );
}