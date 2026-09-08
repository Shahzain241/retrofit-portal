/**
 * Shared StatCard — headline metric card (icon + value + label).
 * Used on the Client Dashboard (default) and Admin Dashboard (compact variant).
 */
export default function StatCard({ icon: Icon, value, label, variant = 'default', compact = false, labelClassName = '' }) {
  if (compact) {
    return (
      <div className="admin-stat-card">
        <div className="admin-stat-icon">
          <Icon size={20} strokeWidth={1.5} className="text-muted" />
        </div>
        <p className={`admin-stat-value ${variant === 'danger' ? 'admin-stat-value-danger' : 'admin-stat-value-success'}`}>
          {value}
        </p>
        <p className={`admin-stat-label${labelClassName ? ` ${labelClassName}` : ''}`}>{label}</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-[15px] p-[17px] border border-line/60 shadow-[0px_4px_4.8px_0px_rgba(11,28,48,0.25)] flex flex-col gap-[15px]">
      <div className="flex items-center justify-center w-[35px] h-[35px] rounded-[4px] bg-[rgba(11,28,48,0.11)] shadow-[0px_4px_4.8px_0px_rgba(11,28,48,0.25)]">
        <Icon size={16} className="text-ink" />
      </div>
      <p className={`mt-[8px] text-[30px] leading-none font-extrabold ${variant === 'danger' ? 'text-danger' : 'text-[#12B14E]'}`}>{value}</p>
      <p className="text-[13px] font-bold tracking-wide text-[#6B7280] uppercase">{label}</p>
    </div>
  );
}
