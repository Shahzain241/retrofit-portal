import { taskBoardColumns } from '../../data/projects';

export default function TaskBoard() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-ink">RET-2026-0042</h1>
      <p className="text-body mt-1 mb-6">High-Efficiency Heat Pump Installation Cluster</p>

      <h3 className="text-xl font-bold text-ink mb-4">Task Board</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {taskBoardColumns.map((col) => (
          <div key={col.id} className="bg-white rounded-2xl border border-line/60 shadow-sm p-4 min-h-[420px]">
            <div className="flex items-center justify-between mb-4 px-2">
              <h4 className="font-bold text-ink text-sm">{col.title}</h4>
              <span className="text-brand-green text-sm font-semibold">({col.tasks.length})</span>
            </div>
            <div className="space-y-3">
              {col.tasks.map((t) => (
                <div key={t.id} className="border border-line rounded-xl p-4">
                  <p className="font-semibold text-ink text-sm mb-3">{t.title}</p>
                  <div className="flex gap-2">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                          tag === 'Done'
                            ? 'bg-brand-green-light text-brand-green'
                            : 'bg-surface text-body'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
