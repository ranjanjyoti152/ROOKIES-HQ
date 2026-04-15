import { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../api/client';
import {
  User,
  Paperclip,
  Calendar,
  Flag,
  CheckSquare,
  Plus,
  Search,
  LayoutGrid,
  Table,
  RectangleHorizontal,
  GanttChart,
  Layers,
  X,
} from 'lucide-react';

const COLUMNS = [
  { key: 'unassigned', label: 'Unassigned', color: '#6b7280' },
  { key: 'claimed', label: 'Claimed', color: '#f97316' },
  { key: 'editing', label: 'Editing', color: '#eab308' },
  { key: 'internal_review', label: 'Internal Review', color: '#a855f7' },
  { key: 'revision', label: 'Revision', color: '#f97316' },
  { key: 'delivered', label: 'Delivered', color: '#22c55e' },
  { key: 'closed', label: 'Closed', color: '#14b8a6' },
];

const priorityDot = { urgent: '#ef4444', high: '#f97316', medium: '#f97316', low: 'rgba(88,66,55,0.6)' };
const card = { background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px' };

const emptyTask = {
  id: null,
  title: '',
  status: 'unassigned',
  priority: 'medium',
  project_id: '',
  assigned_user_id: '',
  deadline: '',
  attachment_link: '',
  description: '',
};

export default function Pipeline() {
  const [pipeline, setPipeline] = useState({});
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [selected, setSelected] = useState([]);

  const [view, setView] = useState('card');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', project_id: '', priority: 'medium' });

  const [editModal, setEditModal] = useState({ open: false, task: emptyTask, initialStatus: 'unassigned' });

  const fetchData = async () => {
    try {
      const [pipelineRes, projectsRes, membersRes] = await Promise.all([
        api.get('/tasks/pipeline', { params: { project_id: projectFilter || undefined } }),
        api.get('/projects'),
        api.get('/users/mentions').catch(() => ({ data: [] })),
      ]);
      setPipeline(pipelineRes.data || {});
      setProjects(projectsRes.data || []);
      setMembers(membersRes.data || []);
      if (!createForm.project_id && projectsRes.data?.[0]?.id) {
        setCreateForm((prev) => ({ ...prev, project_id: projectsRes.data[0].id }));
      }
      setError('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to load pipeline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [projectFilter]);

  const filteredPipeline = useMemo(() => {
    const query = search.trim().toLowerCase();
    const out = {};
    COLUMNS.forEach((col) => {
      out[col.key] = (pipeline[col.key] || []).filter((t) => {
        const matchesSearch = !query || [t.title, t.description, t.project_tag, t.assigned_user_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query));
        const matchesMember = !memberFilter || t.assigned_user_id === memberFilter;
        return matchesSearch && matchesMember;
      });
    });
    return out;
  }, [pipeline, search, memberFilter]);

  const handleDragEnd = async (result) => {
    if (!result.destination || result.source.droppableId === result.destination.droppableId) return;
    const { source, destination, draggableId } = result;
    const old = { ...pipeline };
    const src = [...(pipeline[source.droppableId] || [])];
    const dst = [...(pipeline[destination.droppableId] || [])];
    const [moved] = src.splice(source.index, 1);
    moved.status = destination.droppableId;
    dst.splice(destination.index, 0, moved);
    setPipeline({ ...pipeline, [source.droppableId]: src, [destination.droppableId]: dst });
    try {
      await api.post(`/tasks/${draggableId}/transition`, { target_status: destination.droppableId });
    } catch {
      setPipeline(old);
    }
  };

  const createTask = async () => {
    if (!createForm.title.trim() || !createForm.project_id) return;
    try {
      await api.post('/tasks', {
        title: createForm.title.trim(),
        project_id: createForm.project_id,
        priority: createForm.priority,
      });
      setShowCreate(false);
      setCreateForm((prev) => ({ ...prev, title: '' }));
      await fetchData();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create task.');
    }
  };

  const openTaskModal = async (taskId) => {
    try {
      const res = await api.get(`/tasks/${taskId}`);
      const t = res.data;
      setEditModal({
        open: true,
        initialStatus: t.status,
        task: {
          ...emptyTask,
          ...t,
          deadline: t.deadline ? t.deadline.slice(0, 16) : '',
        },
      });
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load task details.');
    }
  };

  const saveTask = async () => {
    const t = editModal.task;
    if (!t.id) return;
    try {
      await api.put(`/tasks/${t.id}`, {
        title: t.title,
        description: t.description || null,
        assigned_user_id: t.assigned_user_id || null,
        priority: t.priority,
        deadline: t.deadline || null,
        attachment_link: t.attachment_link || null,
        is_flagged: !!t.is_flagged,
      });
      if (t.status && t.status !== editModal.initialStatus) {
        await api.post(`/tasks/${t.id}/transition`, { target_status: t.status });
      }
      setEditModal({ open: false, task: emptyTask, initialStatus: 'unassigned' });
      await fetchData();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save task.');
    }
  };

  const toggleFlag = async (task) => {
    try {
      await api.put(`/tasks/${task.id}`, { is_flagged: !task.is_flagged });
      await fetchData();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update flag.');
    }
  };

  const markCompleteToReview = async (task) => {
    try {
      await api.post(`/tasks/${task.id}/transition`, { target_status: 'internal_review' });
      await fetchData();
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to move task to Internal Review.');
    }
  };

  const toggleSelect = (taskId) => {
    setSelected((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]));
  };

  const bulkMoveInternalReview = async () => {
    if (selected.length === 0) return;
    await Promise.all(
      selected.map((taskId) => api.post(`/tasks/${taskId}/transition`, { target_status: 'internal_review' }).catch(() => null))
    );
    setSelected([]);
    await fetchData();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.25s ease-out' }}>
      {error && <div style={{ ...card, padding: '10px 12px', marginBottom: '10px', fontSize: '12px', color: '#f87171' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Project Pipeline</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setShowCreate(true)} style={{ border: 'none', borderRadius: '8px', background: '#f97316', color: 'white', fontSize: '12px', padding: '8px 12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}><Plus size={13} /> + New Task</button>
          <button onClick={bulkMoveInternalReview} disabled={!selected.length} style={{ border: '1px solid rgba(88,66,55,0.34)', borderRadius: '8px', background: selected.length ? 'rgba(249,115,22,0.14)' : 'transparent', color: selected.length ? '#ffb690' : 'rgba(167,139,125,0.55)', fontSize: '12px', padding: '8px 12px', fontWeight: 700, cursor: selected.length ? 'pointer' : 'default' }}>
            Bulk ({selected.length})
          </button>
        </div>
      </div>

      <div style={{ ...card, padding: '10px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 260px' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(88,66,55,0.5)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..." className="ui-input-compact" style={{ paddingLeft: '30px' }} />
        </div>

        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="ui-select ui-select-sm" style={{ minWidth: '170px' }}>
          <option value="">PROJECT PIPELINE</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} className="ui-select ui-select-sm" style={{ minWidth: '150px' }}>
          <option value="">All Members</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
        </select>

        <div style={{ display: 'flex', border: '1px solid rgba(88,66,55,0.3)', borderRadius: '8px', overflow: 'hidden' }}>
          {[
            { key: 'grid', icon: LayoutGrid },
            { key: 'table', icon: Table },
            { key: 'card', icon: RectangleHorizontal },
            { key: 'timeline', icon: GanttChart },
          ].map((v) => {
            const Icon = v.icon;
            return (
              <button key={v.key} onClick={() => setView(v.key)} style={{ border: 'none', background: view === v.key ? 'rgba(249,115,22,0.14)' : 'transparent', color: view === v.key ? '#ffb690' : 'rgba(167,139,125,0.64)', padding: '7px 9px', cursor: 'pointer' }}>
                <Icon size={13} />
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ ...card, padding: '14px', fontSize: '12px', color: 'rgba(167,139,125,0.65)' }}>Loading pipeline...</div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', gap: '10px', flex: 1, overflowX: 'auto', paddingBottom: '16px' }}>
            {COLUMNS.map((col) => {
              const tasks = filteredPipeline[col.key] || [];
              return (
                <Droppable key={col.key} droppableId={col.key}>
                  {(provided, snapshot) => (
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: '250px', width: '250px', borderRadius: '10px', background: snapshot.isDraggingOver ? '#0f0f18' : '#1a1210', border: '1px solid rgba(88,66,55,0.15)', transition: 'background 150ms' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid rgba(88,66,55,0.15)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#e0c0b1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.label}</span>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(88,66,55,0.6)' }}>{tasks.length}</span>
                      </div>

                      <div ref={provided.innerRef} {...provided.droppableProps} style={{ flex: 1, overflowY: 'auto', padding: '8px', minHeight: '100px' }}>
                        {tasks.map((task, i) => (
                          <Draggable key={task.id} draggableId={task.id} index={i}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                style={{
                                  ...prov.draggableProps.style,
                                  padding: '10px',
                                  borderRadius: '8px',
                                  marginBottom: '6px',
                                  background: snap.isDragging ? '#2f2926' : '#201a18',
                                  border: snap.isDragging ? '1px solid #f97316' : '1px solid rgba(88,66,55,0.2)',
                                  cursor: 'grab',
                                }}
                                onClick={() => openTaskModal(task.id)}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px', marginBottom: '6px' }}>
                                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#ece0dc', margin: 0, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.title}</p>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <button onClick={(e) => { e.stopPropagation(); toggleFlag(task); }} style={{ border: 'none', background: 'transparent', color: task.is_flagged ? '#f97316' : 'rgba(88,66,55,0.55)', cursor: 'pointer', padding: 0 }}><Flag size={12} fill={task.is_flagged ? '#f97316' : 'none'} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); markCompleteToReview(task); }} style={{ border: 'none', background: 'transparent', color: 'rgba(167,139,125,0.72)', cursor: 'pointer', padding: 0 }}><CheckSquare size={12} /></button>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: priorityDot[task.priority] || 'rgba(88,66,55,0.6)', display: 'inline-block' }} />
                                    <span style={{ fontSize: '10px', color: 'rgba(88,66,55,0.5)', textTransform: 'capitalize' }}>{task.priority}</span>
                                    {task.revision_badge_count > 0 && (
                                      <>
                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
                                        <span style={{ fontSize: '10px', color: '#ffb690', fontWeight: 700 }}>{task.revision_badge_count}</span>
                                      </>
                                    )}
                                  </div>
                                  <input type="checkbox" checked={selected.includes(task.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(task.id); }} onClick={(e) => e.stopPropagation()} />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  {task.assigned_user_name ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#2f2926', border: '1px solid rgba(88,66,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <User size={8} style={{ color: 'rgba(88,66,55,0.6)' }} />
                                      </div>
                                      <span style={{ fontSize: '10px', color: 'rgba(88,66,55,0.6)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.assigned_user_name}</span>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '10px', color: 'rgba(88,66,55,0.5)', fontStyle: 'italic' }}>unassigned</span>
                                  )}

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {task.attachment_link && <Paperclip size={10} style={{ color: 'rgba(88,66,55,0.5)' }} />}
                                    {task.deadline && <Calendar size={10} style={{ color: 'rgba(88,66,55,0.5)' }} />}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {showCreate && (
        <div className="ui-overlay" style={{ zIndex: 1200, padding: '16px' }} onClick={() => setShowCreate(false)}>
          <div className="ui-subwindow" style={{ ...card, width: 'min(460px, 100%)', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#f0e0d9' }}>+ Task</h3>
              <button onClick={() => setShowCreate(false)} style={{ border: 'none', background: 'transparent', color: 'rgba(167,139,125,0.7)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <input value={createForm.title} onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))} placeholder="Task title" className="ui-input-compact" />
              <select value={createForm.project_id} onChange={(e) => setCreateForm((p) => ({ ...p, project_id: e.target.value }))} className="ui-select ui-select-sm">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={createForm.priority} onChange={(e) => setCreateForm((p) => ({ ...p, priority: e.target.value }))} className="ui-select ui-select-sm">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', gap: '8px' }}>
              <button onClick={() => setShowCreate(false)} style={{ border: '1px solid rgba(88,66,55,0.33)', background: 'transparent', color: 'rgba(167,139,125,0.75)', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={createTask} style={{ border: 'none', background: '#f97316', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {editModal.open && (
        <div className="ui-overlay" style={{ zIndex: 1200, padding: '16px' }} onClick={() => setEditModal({ open: false, task: emptyTask, initialStatus: 'unassigned' })}>
          <div className="ui-subwindow" style={{ ...card, width: 'min(720px, 100%)', padding: '18px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#f0e0d9' }}>Edit Task</h3>
              <button onClick={() => setEditModal({ open: false, task: emptyTask, initialStatus: 'unassigned' })} style={{ border: 'none', background: 'transparent', color: 'rgba(167,139,125,0.7)', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input value={editModal.task.title} onChange={(e) => setEditModal((p) => ({ ...p, task: { ...p.task, title: e.target.value } }))} placeholder="Title" className="ui-input-compact" />

              <select value={editModal.task.status} onChange={(e) => setEditModal((p) => ({ ...p, task: { ...p.task, status: e.target.value } }))} className="ui-select ui-select-sm">
                {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>

              <select value={editModal.task.priority} onChange={(e) => setEditModal((p) => ({ ...p, task: { ...p.task, priority: e.target.value } }))} className="ui-select ui-select-sm">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select value={editModal.task.assigned_user_id || ''} onChange={(e) => setEditModal((p) => ({ ...p, task: { ...p.task, assigned_user_id: e.target.value } }))} className="ui-select ui-select-sm">
                <option value="">Unassigned</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>

              <input type="datetime-local" value={editModal.task.deadline || ''} onChange={(e) => setEditModal((p) => ({ ...p, task: { ...p.task, deadline: e.target.value } }))} className="ui-input-compact" />
              <input value={editModal.task.attachment_link || ''} onChange={(e) => setEditModal((p) => ({ ...p, task: { ...p.task, attachment_link: e.target.value } }))} placeholder="Link / Attachment" className="ui-input-compact" />
            </div>

            <textarea value={editModal.task.description || ''} onChange={(e) => setEditModal((p) => ({ ...p, task: { ...p.task, description: e.target.value } }))} rows={4} placeholder="Notes / comments / dependencies / time tracking context" className="ui-input-compact" style={{ marginTop: '8px', resize: 'vertical', paddingTop: '8px', paddingBottom: '8px' }} />

            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setEditModal({ open: false, task: emptyTask, initialStatus: 'unassigned' })} style={{ border: '1px solid rgba(88,66,55,0.33)', background: 'transparent', color: 'rgba(167,139,125,0.75)', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveTask} style={{ border: 'none', background: '#f97316', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={12} /> Save Task
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }`}</style>
    </div>
  );
}
