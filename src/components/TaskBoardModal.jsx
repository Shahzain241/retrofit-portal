import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import TaskBoard from '../pages/admin/TaskBoard';
import '../styles/TaskBoard.css';

/**
 * Slide-over wrapper that renders the Task Board on top of the admin
 * Dashboard instead of navigating to a dedicated route. The Dashboard stays
 * mounted underneath; closing returns focus back to it with no route change.
 */
export default function TaskBoardModal({ open, onClose, projectId }) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e) {
      if (e.key === 'Escape') onCloseRef.current();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="tb-overlay" onClick={onClose} role="presentation">
      <div
        className="tb-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Task board"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tb-panel-header">
          <button type="button" className="tb-close" onClick={onClose} aria-label="Close task board">
            <X size={20} />
          </button>
        </div>
        <div className="tb-panel-body">
          <TaskBoard projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
