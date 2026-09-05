import { projectTabs } from '../data/projectTabs';
import '../styles/ProjectTabs.css';

/**
 * Shared ProjectTabs — the tab bar on the client Project Detail page.
 * Renders the tab list from data/projectTabs and optional count badges.
 */
export default function ProjectTabs({ active, onChange, badges = {} }) {
  return (
    <div className="rp-project-tabs border-b border-dashed border-line mt-6">
      <div className="flex items-center gap-5 sm:gap-10 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {projectTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`pb-4 text-sm sm:text-base font-medium transition-colors flex items-center whitespace-nowrap focus:outline-none ${
              active === t.key ? 'text-ink font-bold' : 'text-muted'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <span className="relative">
                {t.label}
                {active === t.key && (
                  <span className="absolute -bottom-[3px] left-0 right-0" aria-hidden="true">
                    <span className="block h-0.5 bg-brand-green" />
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-green" />
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-green" />
                  </span>
                )}
              </span>
              {badges[t.key] > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-green text-white text-[10px] font-bold inline-flex items-center justify-center align-middle">
                  {badges[t.key]}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
