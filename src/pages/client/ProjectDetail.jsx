import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import ProjectHeaderCard from '../../components/ProjectHeaderCard';
import ProjectTabs from '../../components/ProjectTabs';
import { projects } from '../../data/projects';
import OverviewTab from './project-tabs/OverviewTab';
import TaskDocsTab from './project-tabs/TaskDocsTab';
import CommunicationTab from './project-tabs/CommunicationTab';
import TimelineTab from './project-tabs/TimelineTab';
import DeliverablesTab from './project-tabs/DeliverablesTab';

export default function ProjectDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState('overview');
  const project = projects.find((p) => p.id === id) || projects[0];

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted mb-2">
        <Link to="/projects" className="hover:text-ink">Project</Link>
        <ChevronRight size={14} />
        <span className="text-ink font-medium">{project.id}</span>
      </div>
      <h1 className="text-3xl font-bold text-ink mb-1">{project.id}</h1>
      <p className="text-body mb-6">{project.name}</p>

      <ProjectHeaderCard project={project} />

      <ProjectTabs active={tab} onChange={setTab} badges={{ communication: 2 }} />

      {tab === 'overview' && <OverviewTab project={project} />}
      {tab === 'tasks' && <TaskDocsTab />}
      {tab === 'communication' && <CommunicationTab />}
      {tab === 'timeline' && <TimelineTab />}
      {tab === 'deliverables' && <DeliverablesTab />}
    </div>
  );
}
