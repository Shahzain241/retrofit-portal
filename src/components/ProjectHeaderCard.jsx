export default function ProjectHeaderCard({ project }) {
  return (
    <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 flex flex-col md:flex-row gap-6">
      <img
        src={project.image}
        alt={project.address}
        className="w-full md:w-56 h-40 object-cover rounded-xl"
      />
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-ink">{project.address}</h2>
            <p className="text-body mt-1">{project.location}</p>
          </div>
          <span className="bg-brand-green-light text-brand-green text-xs font-bold px-3 py-1.5 rounded-full">
            {project.tag}
          </span>
        </div>

        <div className="flex items-center gap-3 border-t border-dashed border-line mt-4 pt-4">
          <img
            src={project.coordinator.avatar}
            alt={project.coordinator.name}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <p className="font-semibold text-ink text-sm">{project.coordinator.name}</p>
            <p className="text-xs text-muted">{project.coordinator.role}</p>
            <p className="text-xs text-muted">{project.coordinator.email}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-body font-medium">Progress</span>
            <span className="text-brand-green font-bold">{project.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-line overflow-hidden">
            <div
              className="h-full bg-brand-green rounded-full"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
