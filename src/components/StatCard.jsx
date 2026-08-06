export default function StatCard({ icon: Icon, value, label, dark = false }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-line/60">
      <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center mb-4">
        <Icon size={16} className="text-ink" />
      </div>
      <p className={`text-3xl font-bold ${dark ? 'text-danger' : 'text-brand-green'}`}>{value}</p>
      <p className="text-xs font-semibold tracking-wide text-muted mt-1 uppercase">{label}</p>
    </div>
  );
}
