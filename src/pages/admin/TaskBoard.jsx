import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical, Plus, Pencil, Search } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/Button';
import { taskBoardColumns } from '../../data/projects';
import { useToast } from '../../context/ToastContext';
import '../../styles/TaskBoard.css';

const PRIORITIES = ['Low', 'Medium', 'High'];
const PRIORITY_TEXT = { High: 'text-danger', Medium: 'text-warning', Low: 'text-muted' };

let taskSeq = 0;
function nextTaskId() {
  taskSeq += 1;
  return `task-${Date.now()}-${taskSeq}`;
}

export default function TaskBoard({ projectId }) {
  const params = useParams();
  const activeProjectId = projectId || params.id || 'RET-2026-0042';
  const [columns, setColumns] = useState(() =>
    taskBoardColumns.map((col) => ({
      ...col,
      tasks: col.tasks.map((t) => ({ assignee: '', priority: 'Medium', dueDate: '', tags: [], ...t })),
    })),
  );
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const { showToast } = useToast();

  const assignees = useMemo(() => {
    const set = new Set();
    columns.forEach((col) => col.tasks.forEach((t) => t.assignee && set.add(t.assignee)));
    return [...set];
  }, [columns]);

  const visibleColumns = useMemo(() => {
    return columns.map((col) => {
      const tasks = col.tasks.filter((t) => {
        const matchesPriority = priorityFilter === 'All' || t.priority === priorityFilter;
        const matchesAssignee =
          assigneeFilter === 'All' ||
          (assigneeFilter === 'Unassigned' ? !t.assignee : t.assignee === assigneeFilter);
        const matchesSearch =
          !search || (t.title || '').toLowerCase().includes(search.toLowerCase());
        return matchesPriority && matchesAssignee && matchesSearch;
      });
      return { ...col, tasks };
    });
  }, [columns, priorityFilter, assigneeFilter, search]);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id;
    const targetColId = over.id;
    setColumns((cols) => {
      let sourceColId = null;
      let task = null;
      for (const col of cols) {
        const found = col.tasks.find((t) => t.id === taskId);
        if (found) {
          sourceColId = col.id;
          task = found;
          break;
        }
      }
      if (!task || sourceColId === targetColId) return cols;
      return cols.map((col) => {
        if (col.id === sourceColId) return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
        if (col.id === targetColId) return { ...col, tasks: [...col.tasks, task] };
        return col;
      });
    });
  }

  function handleCreate(data) {
    const task = { id: nextTaskId(), tags: [], ...data, columnId: undefined };
    setColumns((cols) =>
      cols.map((col) => (col.id === 'backlog' ? { ...col, tasks: [...col.tasks, task] } : col)),
    );
    setModal(null);
    showToast({ type: 'success', message: 'Task created' });
  }

  function handleEditSave(columnId, taskId, updates, newColumnId) {
    const targetId = newColumnId || columnId;
    setColumns((cols) => {
      let task = null;
      for (const col of cols) {
        const found = col.tasks.find((t) => t.id === taskId);
        if (found) {
          task = { ...found, ...updates };
          break;
        }
      }
      if (!task) return cols;
      return cols
        .map((col) =>
          col.id === columnId ? { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) } : col,
        )
        .map((col) => (col.id === targetId ? { ...col, tasks: [...col.tasks, task] } : col));
    });
    setModal(null);
    showToast({ type: 'success', message: 'Task updated' });
  }

  return (
    <div className="max-w-[1120px] mx-auto">
      <h1 className="font-['Inter'] font-semibold text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1C30]">{activeProjectId}</h1>
      <p className="text-body mt-1 mb-6">High-Efficiency Heat Pump Installation Cluster</p>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-['Inter'] font-semibold text-[20px] leading-[28px] tracking-[0px] text-[#0B1C30]">Task Board</h3>
        <Button variant="green" onClick={() => setModal({ mode: 'create' })} className="!py-2 !px-4">
          <Plus size={16} /> New Task
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            aria-label="Search tasks"
            className="w-56 rounded-xl border border-line bg-white pl-9 pr-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          />
        </div>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          aria-label="Filter by assignee"
          className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        >
          <option value="All">All assignees</option>
          <option value="Unassigned">Unassigned</option>
          {assignees.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Filter by priority"
          className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        >
          <option value="All">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {visibleColumns.map((col) => (
            <DroppableColumn
              key={col.id}
              col={col}
              onEdit={(task) => setModal({ mode: 'edit', columnId: col.id, task })}
            />
          ))}
        </div>
      </DndContext>

      <Modal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit Task' : 'New Task'}
      >
        {modal?.mode === 'edit' ? (
          <TaskForm
            initial={{ ...modal.task, columnId: modal.columnId }}
            columns={columns}
            showStatus
            onSubmit={(data) =>
              handleEditSave(
                modal.columnId,
                modal.task.id,
                { title: data.title, assignee: data.assignee, priority: data.priority, dueDate: data.dueDate },
                data.columnId,
              )
            }
            onCancel={() => setModal(null)}
          />
        ) : (
          <TaskForm onSubmit={handleCreate} onCancel={() => setModal(null)} />
        )}
      </Modal>
    </div>
  );
}

function DroppableColumn({ col, onEdit }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div ref={setNodeRef} className={`rp-board-col ${isOver ? 'rp-board-col-over' : ''}`}>
      <div className="flex items-center justify-between -mx-4 px-4 mb-4 border-b-2 border-gray-300 pb-3">
        <h4 className="font-['Inter'] font-semibold text-[12px] leading-[100%] tracking-[0px] text-[#0B1C30]">{col.title}</h4>
        <span className="text-brand-green text-sm font-semibold">({col.tasks.length})</span>
      </div>
      <div className="space-y-3">
        {col.tasks.map((t) => (
          <DraggableTask key={t.id} task={t} onEdit={onEdit} />
        ))}
        {col.tasks.length === 0 && (
          <div className="text-xs text-muted text-center py-8 border border-dashed border-line rounded-xl">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableTask({ task, onEdit }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const priorityText = PRIORITY_TEXT[task.priority] || 'text-muted';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-line rounded-xl p-4 bg-white ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag task"
          className="mt-0.5 text-muted hover:text-ink cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-ink text-sm">{task.title}</p>
            <button
              type="button"
              onClick={() => onEdit(task)}
              aria-label="Edit task"
              className="text-muted hover:text-ink shrink-0"
            >
              <Pencil size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                  tag === 'Done' ? 'bg-brand-green-light text-brand-green' : 'bg-surface text-body'
                }`}
              >
                {tag}
              </span>
            ))}
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface ${priorityText}`}>
              {task.priority}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>{task.assignee || 'Unassigned'}</span>
            {task.dueDate && <span>{task.dueDate}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskForm({ initial = {}, columns = [], showStatus = false, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial.title || '');
  const [assignee, setAssignee] = useState(initial.assignee || '');
  const [priority, setPriority] = useState(initial.priority || 'Medium');
  const [dueDate, setDueDate] = useState(initial.dueDate || '');
  const [columnId, setColumnId] = useState(initial.columnId || 'backlog');

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), assignee: assignee.trim(), priority, dueDate, columnId });
  }

  const inputClass =
    'w-full rounded-xl border border-line px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-green/30';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="task-title" className="block text-sm font-semibold text-ink mb-1">Title</label>
        <input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="task-assignee" className="block text-sm font-semibold text-ink mb-1">Assignee</label>
        <input
          id="task-assignee"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="Assignee name"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="task-priority" className="block text-sm font-semibold text-ink mb-1">Priority</label>
          <select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="task-due" className="block text-sm font-semibold text-ink mb-1">Due date</label>
          <input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </div>
      </div>
      {showStatus && (
        <div>
          <label htmlFor="task-status" className="block text-sm font-semibold text-ink mb-1">Status</label>
          <select id="task-status" value={columnId} onChange={(e) => setColumnId(e.target.value)} className={inputClass}>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="navy" disabled={!title.trim()}>Save</Button>
      </div>
    </form>
  );
}
