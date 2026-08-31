import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical, Plus, Pencil, Search } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/Button';
import { taskBoardColumns } from '../../data/projects';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/TaskBoard.css';

const PRIORITIES = ['Low', 'Medium', 'High'];
const PRIORITY_TEXT = { High: 'text-danger', Medium: 'text-warning', Low: 'text-muted' };
const BACKLOG = 'backlog';

export default function TaskBoard({ projectId }) {
  const params = useParams();
  const activeProjectId = projectId || params.id || 'RET-2026-0042';
  const [projectName, setProjectName] = useState('');
  const [columns, setColumns] = useState(() =>
    taskBoardColumns.map((col) => ({ ...col, tasks: [] })),
  );
  const [staffProfiles, setStaffProfiles] = useState([]);
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

  const fetchTasks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, assignee_profile:profiles(id, full_name, email)')
        .eq('project_id', activeProjectId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);

      const byStatus = {};
      (data ?? []).forEach((t) => {
        byStatus[t.status] = byStatus[t.status] || [];
        byStatus[t.status].push({
          id: t.id,
          title: t.title,
          priority: t.priority,
          dueDate: t.due_date || '',
          tags: Array.isArray(t.tags) ? t.tags : [],
          assignee: t.assignee_profile ? t.assignee_profile.full_name || t.assignee_profile.email || '' : '',
          assignee_id: t.assignee_id,
          status: t.status,
        });
      });
      setColumns(taskBoardColumns.map((col) => ({ ...col, tasks: byStatus[col.id] ?? [] })));
    } catch (err) {
      showToast({ type: 'error', message: err?.message || 'Could not load tasks.' });
    }
  }, [activeProjectId, showToast]);

  const fetchStaff = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['coordinator', 'designer', 'assessor', 'super-admin']);
      if (error) throw new Error(error.message);
      setStaffProfiles(data ?? []);
    } catch (err) {
      showToast({ type: 'error', message: err?.message || 'Could not load staff.' });
    }
  }, [showToast]);

  useEffect(() => {
    fetchStaff();
    fetchTasks();
  }, [fetchStaff, fetchTasks]);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('projects')
      .select('name')
      .eq('id', activeProjectId)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted && data?.name) setProjectName(data.name);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [activeProjectId]);

  async function persistStatusChange(taskId, newStatus, sourceStatus) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId)
        .select('id');
      // RLS can silently filter the row out (0 rows, no error) — e.g. a staff
      // user dragging a task that isn't assigned to them. Detect it and revert
      // the optimistic move instead of letting the UI look successful.
      if (error || (data ?? []).length === 0) {
        revertTaskMove(taskId, newStatus, sourceStatus);
        showToast({
          type: 'error',
          message: error?.message || 'Could not update task status — you may not have permission to move this task.',
        });
        return;
      }
    } catch (err) {
      revertTaskMove(taskId, newStatus, sourceStatus);
      showToast({ type: 'error', message: err?.message || 'Could not update task status.' });
    }
  }

  // Move a card back from one column to another after a failed persist.
  function revertTaskMove(taskId, fromStatus, toStatus) {
    setColumns((cols) => {
      let task = null;
      const without = cols.map((col) => {
        if (col.id === fromStatus) {
          const found = col.tasks.find((t) => t.id === taskId);
          if (found) task = found;
          return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
        }
        return col;
      });
      if (!task) return cols;
      return without.map((col) =>
        col.id === toStatus ? { ...col, tasks: [...col.tasks, task] } : col,
      );
    });
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id;
    const targetColId = over.id;

    let sourceColId = null;
    let task = null;
    for (const col of columns) {
      const found = col.tasks.find((t) => t.id === taskId);
      if (found) {
        sourceColId = col.id;
        task = found;
        break;
      }
    }
    if (!task || sourceColId === targetColId) return;

    // Optimistic move.
    setColumns((cols) =>
      cols.map((col) => {
        if (col.id === sourceColId) return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
        if (col.id === targetColId) return { ...col, tasks: [...col.tasks, task] };
        return col;
      }),
    );
    persistStatusChange(taskId, targetColId, sourceColId);
  }

  async function handleCreate(data) {
    try {
      const { error } = await supabase.from('tasks').insert({
        title: data.title,
        priority: data.priority,
        due_date: data.dueDate || null,
        assignee_id: data.assigneeId || null,
        status: BACKLOG,
        project_id: activeProjectId,
        tags: [],
      });
      if (error) {
        showToast({ type: 'error', message: error.message || 'Could not create the task.' });
        return;
      }
      setModal(null);
      showToast({ type: 'success', message: 'Task created' });
      fetchTasks();
    } catch (err) {
      showToast({ type: 'error', message: err?.message || 'Could not create the task.' });
    }
  }

  async function handleEditSave(columnId, taskId, updates, newColumnId) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          title: updates.title,
          priority: updates.priority,
          due_date: updates.dueDate || null,
          assignee_id: updates.assigneeId || null,
          status: newColumnId || columnId,
        })
        .eq('id', taskId)
        .select('id');
      // 0 rows back = RLS blocked it (e.g. a staff user editing a task not
      // assigned to them) or the task vanished — never claim success for a
      // write that didn't land.
      if (error || (data ?? []).length === 0) {
        showToast({
          type: 'error',
          message: error?.message || 'Could not update the task — you may not have permission to edit it.',
        });
        return;
      }
      setModal(null);
      showToast({ type: 'success', message: 'Task updated' });
      fetchTasks();
    } catch (err) {
      showToast({ type: 'error', message: err?.message || 'Could not update the task.' });
    }
  }

  return (
    <div className="max-w-[1120px] mx-auto">
      <h1 className="font-['Inter'] font-semibold text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1C30]">{activeProjectId}</h1>
      <p className="text-body mt-1 mb-6">{projectName || 'Task board'}</p>

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
            initial={{
              ...modal.task,
              columnId: modal.columnId,
              assigneeId: modal.task.assignee_id,
              assigneeName: modal.task.assignee,
            }}
            staff={staffProfiles}
            columns={columns}
            showStatus
            onSubmit={(data) =>
              handleEditSave(
                modal.columnId,
                modal.task.id,
                { title: data.title, assigneeId: data.assigneeId, priority: data.priority, dueDate: data.dueDate },
                data.columnId,
              )
            }
            onCancel={() => setModal(null)}
          />
        ) : (
          <TaskForm staff={staffProfiles} onSubmit={handleCreate} onCancel={() => setModal(null)} />
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

function TaskForm({ initial = {}, staff = [], columns = [], showStatus = false, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial.title || '');
  // Real assignee picker: only staff profiles (ids) can be selected, never an
  // arbitrary typed name. Empty string = explicit "Unassigned".
  const [assigneeId, setAssigneeId] = useState(initial.assigneeId || '');
  const [priority, setPriority] = useState(initial.priority || 'Medium');
  const [dueDate, setDueDate] = useState(initial.dueDate || '');
  const [columnId, setColumnId] = useState(initial.columnId || 'backlog');

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), assigneeId, priority, dueDate, columnId });
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
        <select
          id="task-assignee"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className={inputClass}
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
          ))}
          {/* If the staff list isn't loaded yet, keep the task's current
              assignee selectable so a save never silently nulls it out. */}
          {initial.assigneeId && !staff.some((s) => s.id === initial.assigneeId) && (
            <option value={initial.assigneeId}>{initial.assigneeName || 'Current assignee'}</option>
          )}
        </select>
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