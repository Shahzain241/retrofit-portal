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
    <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-line/60 shadow-[0px_4px_4.8px_0px_rgba(11,28,48,0.25)]">
      <div className="flex items-center justify-center mb-2 w-[35px] h-[35px] rounded-[4px] bg-[rgba(11,28,48,0.11)] shadow-[0px_4px_4.8px_0px_rgba(11,28,48,0.25)]">
        <Icon size={16} className="text-ink" />
      </div>
      <p className={`text-[28px] leading-none font-bold ${variant === 'danger' ? 'text-danger' : 'text-[#12B14E]'}`}>{value}</p>
      <p className="text-[12px] font-semibold tracking-wide text-[#6B7280] mt-1 uppercase">{label}</p>
    </div>
  );
}
