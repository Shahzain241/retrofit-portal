const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Task & Docs' },
  { key: 'communication', label: 'Communication' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'deliverables', label: 'Deliverables' },
];

export default function ProjectTabs({ active, onChange, badges = {} }) {
  return (
    <div className="border-b border-dashed border-line mt-6">
      <div className="flex items-center gap-10">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative pb-4 text-base font-medium transition-colors flex items-center gap-2 ${
              active === t.key ? 'text-ink font-bold' : 'text-muted'
            }`}
          >
            {t.label}
            {badges[t.key] && (
              <span className="w-5 h-5 rounded-full bg-brand-green text-white text-[10px] flex items-center justify-center">
                {badges[t.key]}
              </span>
            )}
            {active === t.key && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-green" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
