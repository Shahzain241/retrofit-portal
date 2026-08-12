import '../styles/Badge.css';

const variantClass = {
  green: 'rp-badge-green',
  neutral: 'rp-badge-neutral',
  eco: 'rp-badge-eco',
};

/**
 * Shared Badge component — small status/tag chips used across dashboards
 * and public pages. See styles/Badge.css for the palette.
 */
export default function Badge({ variant = 'green', className = '', children }) {
  return <span className={`rp-badge ${variantClass[variant] || ''} ${className}`}>{children}</span>;
}