import { projectTabs } from '../data/projectTabs';

/**
 * Shared ProjectTabs — the tab bar on the client Project Detail page.
 * Renders the tab list from data/projectTabs and optional count badges.
 */
export default function ProjectTabs({ active, onChange, badges = {} }) {
  return (
    <div className="border-b border-dashed border-line mt-6">
      <div className="flex items-center gap-5 sm:gap-10 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {projectTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative pb-4 text-sm sm:text-base font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
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
