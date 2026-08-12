import '../styles/ProgressBar.css';

/**
 * Shared ProgressBar — replaces every inline progress-fill block.
 * `value` is a 0-100 percentage; `size` controls the bar height
 * ("sm" = 6px, "md" = 8px); `variant` colors the fill.
 */
export default function ProgressBar({ value, variant = 'green', size = 'sm' }) {
  const fillStyle = { '--progress': `${value}%` };

  return (
    <div className={`rp-progress rp-progress-${size}`}>
      <div
        className={`rp-progress-fill rp-progress-fill-${variant}`}
        style={fillStyle}
      />
    </div>
  );
}