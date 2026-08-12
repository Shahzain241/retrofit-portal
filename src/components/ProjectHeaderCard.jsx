import '../styles/ProjectHeaderCard.css';
import ProgressBar from './ProgressBar';
import clientdash4 from '../assets/clientdash4.jpg';

/**
 * Project header card rendered at the top of the client Project Detail page —
 * image, address/tag, coordinator, and progress. Uses the shared ProgressBar.
 */
export default function ProjectHeaderCard({ project }) {
  return (
    <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 flex flex-col md:flex-row gap-6">
      <img
        src={clientdash4}
        alt={project.address}
        className="rp-projcard-img object-cover shrink-0"
      />
      <div className="flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-ink">{project.address}</h2>
            <p className="text-body mt-1">{project.location}</p>
          </div>
          <span className="bg-brand-green-light text-brand-green text-xs font-bold px-3 py-1.5 rounded-full shrink-0">
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
          <ProgressBar value={project.progress} size="md" />
        </div>
      </div>
    </div>
  );
}