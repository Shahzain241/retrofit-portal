import '../styles/DashboardShared.css';

/**
 * Shared Toggle switch — used for notification prefs (Profile), "HAS ISSUES"
 * filter (Projects Directory), and static permissions switches (Invite Staff,
 * Service Form).
 *
 * Props:
 *   on       - boolean state (false = gray, off position)
 *   onClick  - handler (omit for static/non-interactive switches)
 *   size     - 'lg' (44x24, default) | 'sm' (40x20)
 *   variant  - 'navy' (default) | 'brand' (green "on" fill)
 */
export default function Toggle({ on = false, onClick, size = 'lg', variant = 'navy', 'aria-label': ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={ariaLabel}
      className={`rp-toggle rp-toggle-${size} ${on ? `rp-toggle-on rp-toggle-${variant}-on` : 'rp-toggle-off'}`}
    >
      <span className={`rp-toggle-knob rp-toggle-knob-${size}`} />
    </button>
  );
}