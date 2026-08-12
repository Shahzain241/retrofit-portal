import { taskBoardColumns } from '../../data/projects';
import '../../styles/TaskBoard.css';

export default function TaskBoard() {
  return (
    <div>
      <h1 className="font-['Inter'] font-semibold text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1C30]">RET-2026-0042</h1>
      <p className="text-body mt-1 mb-6">High-Efficiency Heat Pump Installation Cluster</p>

      <h3 className="font-['Inter'] font-semibold text-[20px] leading-[28px] tracking-[0px] text-[#0B1C30] mb-4">Task Board</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {taskBoardColumns.map((col) => (
          <div
            key={col.id}
            className="rp-board-col"
          >
            <div className="flex items-center justify-between -mx-4 px-4 mb-4 border-b-2 border-gray-300 pb-3">
              <h4 className="font-['Inter'] font-semibold text-[12px] leading-[100%] tracking-[0px] text-[#0B1C30]">{col.title}</h4>
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
