/**
 * Shared StatCard — headline metric card (icon + value + label).
 * Used on the Client Dashboard (default) and Admin Dashboard (compact variant).
 */
export default function StatCard({ icon: Icon, value, label, variant = 'default', compact = false }) {
  if (compact) {
    return (
      <div className="admin-stat-card">
        <div className="admin-stat-icon">
          <Icon size={16} />
        </div>
        <p className={`admin-stat-value ${variant === 'danger' ? 'admin-stat-value-danger' : 'admin-stat-value-success'}`}>
          {value}
        </p>
        <p className="admin-stat-label">{label}</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-line/60">
      <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center mb-3 sm:mb-4">
        <Icon size={16} className="text-ink" />
      </div>
      <p className={`text-2xl sm:text-3xl font-bold ${variant === 'danger' ? 'text-danger' : 'text-brand-green'}`}>{value}</p>
      <p className="text-[11px] sm:text-xs font-semibold tracking-wide text-muted mt-1 uppercase">{label}</p>
    </div>
  );
}
