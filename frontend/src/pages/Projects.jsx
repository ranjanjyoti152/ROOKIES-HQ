import { useMemo, useState, useEffect } from 'react';
import api from '../api/client';
import { Plus, FolderOpen, Search, LayoutGrid, List, X, Trash2, Filter } from 'lucide-react';

const card = { background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px' };
const label = { display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(167,139,125,0.5)', textTransform: 'uppercase', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '12px 16px', background: '#2f2926', border: '1px solid rgba(88,66,55,0.3)', borderRadius: '8px', fontSize: '14px', color: '#e0c0b1', outline: 'none', boxSizing: 'border-box' };

const statusBadge = {
  active: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  paused: { bg: 'rgba(234,179,8,0.12)', color: '#eab308' },
  completed: { bg: 'rgba(249,115,22,0.12)', color: '#ffb690' },
  archived: { bg: 'rgba(88,66,55,0.2)', color: 'rgba(88,66,55,0.6)' },
};

const tabs = ['tasks', 'canvas', 'notes', 'details'];

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', client_name: '', description: '', status: 'active', member_ids: [], project_tag_id: '', client_tag_ids: [] });
  const [users, setUsers] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const [detailsModal, setDetailsModal] = useState({ open: false, tab: 'tasks', project: null, tasks: [], notes: [], period: 'all' });

  const fetchProjects = async () => {
    try {
      const params = activeTag ? { tag_id: activeTag } : {};
      const r = await api.get('/projects', { params });
      setProjects(r.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to load projects.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [usersRes, tagsRes] = await Promise.all([
        api.get('/users').catch(() => ({ data: [] })),
        api.get('/tags').catch(() => ({ data: [] })),
      ]);
      setUsers(usersRes.data || []);
      setTags(tagsRes.data || []);
    } catch {
      // keep silent fallback
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchMeta();
  }, [activeTag]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { id, ...payload } = form;
      const body = {
        ...payload,
        project_tag_id: payload.project_tag_id || null,
      };
      if (id) {
        await api.put(`/projects/${id}`, body);
      } else {
        await api.post('/projects', body);
      }
      setShowCreate(false);
      setForm({ name: '', client_name: '', description: '', status: 'active', member_ids: [], project_tag_id: '', client_tag_ids: [] });
      await fetchProjects();
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save project.');
    }
  };

  const handleDelete = async (projectId) => {
    if (!confirm('Are you sure you want to archive this project?')) return;
    setDeleting(true);
    try {
      await api.delete(`/projects/${projectId}`);
      setShowCreate(false);
      setForm({ name: '', client_name: '', description: '', status: 'active', member_ids: [], project_tag_id: '', client_tag_ids: [] });
      await fetchProjects();
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to archive project.');
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (p) => {
    setForm({
      id: p.id,
      name: p.name,
      client_name: p.client_name || '',
      description: p.description || '',
      status: p.status || 'active',
      member_ids: p.assigned_members ? p.assigned_members.map((m) => m.id) : [],
      project_tag_id: p.project_tag_id || '',
      client_tag_ids: [],
    });
    setShowCreate(true);
  };

  const openDetails = async (project) => {
    try {
      const [tasksRes, notesRes] = await Promise.all([
        api.get('/tasks', { params: { project_id: project.id } }),
        api.get('/notes').catch(() => ({ data: [] })),
      ]);
      setDetailsModal({
        open: true,
        tab: 'tasks',
        project,
        tasks: tasksRes.data || [],
        notes: (notesRes.data || []).filter((n) => n.project_id === project.id),
        period: 'all',
      });
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to open project details.');
    }
  };

  const projectTags = tags.filter((t) => t.kind === 'project');
  const clientTags = tags.filter((t) => t.kind === 'client');

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return projects.filter((p) =>
      [p.name, p.client_name, p.project_tag, p.lead_origin]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query))
    );
  }, [projects, search]);

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {loading && <div style={{ ...card, padding: '12px 14px', marginBottom: '12px', fontSize: '12px', color: 'rgba(167,139,125,0.7)' }}>Loading projects...</div>}
      {error && <div style={{ ...card, padding: '12px 14px', marginBottom: '12px', fontSize: '12px', color: '#f87171' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Projects</h1>
        <button onClick={() => { setForm({ name: '', client_name: '', description: '', status: 'active', member_ids: [], project_tag_id: '', client_tag_ids: [] }); setShowCreate(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px', background: '#f97316', border: 'none', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} /> New Project
        </button>
      </div>

      <div style={{ ...card, padding: '10px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Filter size={13} style={{ color: 'rgba(167,139,125,0.65)' }} />
          <span style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(167,139,125,0.65)', fontWeight: 700 }}>Project Tags</span>
          <button onClick={() => setActiveTag('')} style={{ border: '1px solid rgba(88,66,55,0.34)', borderRadius: '20px', background: activeTag ? 'transparent' : 'rgba(249,115,22,0.16)', color: activeTag ? 'rgba(167,139,125,0.72)' : '#ffb690', fontSize: '11px', padding: '4px 10px', cursor: 'pointer' }}>All</button>
          {projectTags.map((tag) => (
            <button key={tag.id} onClick={() => setActiveTag(tag.id)} style={{ border: '1px solid rgba(88,66,55,0.34)', borderRadius: '20px', background: activeTag === tag.id ? 'rgba(249,115,22,0.16)' : 'transparent', color: activeTag === tag.id ? '#ffb690' : 'rgba(167,139,125,0.72)', fontSize: '11px', padding: '4px 10px', cursor: 'pointer' }}>{tag.name}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(88,66,55,0.5)' }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." style={{ ...inputStyle, padding: '10px 12px 10px 34px', fontSize: '12px' }} />
        </div>
        <div style={{ display: 'flex', padding: '2px', borderRadius: '6px', ...card }}>
          <button onClick={() => setView('grid')} style={{ padding: '6px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: view === 'grid' ? 'rgba(249,115,22,0.12)' : 'transparent', color: view === 'grid' ? '#ffb690' : 'rgba(88,66,55,0.6)' }}><LayoutGrid size={14} /></button>
          <button onClick={() => setView('list')} style={{ padding: '6px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: view === 'list' ? 'rgba(249,115,22,0.12)' : 'transparent', color: view === 'list' ? '#ffb690' : 'rgba(88,66,55,0.6)' }}><List size={14} /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...card, padding: '60px 20px', textAlign: 'center' }}>
          <FolderOpen size={40} style={{ color: 'rgba(88,66,55,0.5)', margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#e0c0b1', marginBottom: '6px' }}>No projects yet</h3>
          <p style={{ fontSize: '12px', color: 'rgba(88,66,55,0.5)' }}>Create your first project to get started</p>
        </div>
      ) : (
        <div style={view === 'grid' ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' } : { display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((p) => {
            const sb = statusBadge[p.status] || statusBadge.active;
            return (
              <div key={p.id} style={{ ...card, padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ cursor: 'pointer' }} onClick={() => openDetails(p)}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#ece0dc', margin: 0 }}>{p.name}</h3>
                    <p style={{ fontSize: '11px', color: 'rgba(88,66,55,0.55)', marginTop: '3px' }}>{p.client_name || 'No client'}</p>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {p.project_tag && <span style={{ fontSize: '10px', border: '1px solid rgba(88,66,55,0.35)', borderRadius: '12px', padding: '3px 7px', color: '#ffb690' }}>{p.project_tag}</span>}
                      {(p.client_tags || []).map((tag) => <span key={tag} style={{ fontSize: '10px', border: '1px solid rgba(88,66,55,0.35)', borderRadius: '12px', padding: '3px 7px', color: 'rgba(167,139,125,0.75)' }}>{tag}</span>)}
                    </div>
                  </div>

                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: sb.bg, color: sb.color }}>{p.status}</span>
                </div>

                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'rgba(167,139,125,0.64)' }}>
                  <span>{p.task_count || 0} tasks</span>
                  <span>{p.lead_origin ? 'From lead' : 'Direct project'}</span>
                </div>

                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={() => openDetails(p)} style={{ border: 'none', background: 'rgba(249,115,22,0.14)', color: '#ffb690', borderRadius: '7px', fontSize: '11px', fontWeight: 700, padding: '7px 10px', cursor: 'pointer' }}>Open Details</button>
                  <button onClick={() => openEdit(p)} style={{ border: '1px solid rgba(88,66,55,0.32)', background: 'transparent', color: 'rgba(167,139,125,0.72)', borderRadius: '7px', fontSize: '11px', padding: '7px 10px', cursor: 'pointer' }}>Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="ui-overlay" style={{ zIndex: 100 }} onClick={() => setShowCreate(false)}>
          <div className="ui-subwindow" style={{ ...card, padding: '22px', width: '100%', maxWidth: '560px', animation: 'scaleIn 0.15s ease-out' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ece0dc' }}>{form.id ? 'Edit Project' : 'New Project'}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {form.id && (
                  <button type="button" onClick={() => handleDelete(form.id)} disabled={deleting} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, opacity: deleting ? 0.5 : 1 }}>
                    <Trash2 size={13} /> {deleting ? 'Deleting...' : 'Archive'}
                  </button>
                )}
                <button type="button" onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'rgba(88,66,55,0.6)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={label}>Project Name</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Brand Campaign Q4" style={inputStyle} />
                </div>
                <div>
                  <label style={label}>Client Name</label>
                  <input type="text" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Acme Corp" style={inputStyle} />
                </div>
                <div>
                  <label style={label}>Project Tag</label>
                  <select value={form.project_tag_id || ''} onChange={(e) => setForm({ ...form, project_tag_id: e.target.value })} className="ui-select">
                    <option value="">Auto-generate</option>
                    {projectTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Client Tags</label>
                  <select value="" onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    if (!form.client_tag_ids.includes(id)) {
                      setForm({ ...form, client_tag_ids: [...form.client_tag_ids, id] });
                    }
                  }} className="ui-select">
                    <option value="">Add client tag...</option>
                    {clientTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
                  </select>
                  <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {form.client_tag_ids.map((id) => {
                      const tag = clientTags.find((t) => t.id === id);
                      if (!tag) return null;
                      return <button key={id} type="button" onClick={() => setForm({ ...form, client_tag_ids: form.client_tag_ids.filter((tid) => tid !== id) })} style={{ border: '1px solid rgba(88,66,55,0.3)', borderRadius: '14px', background: 'transparent', color: '#ffb690', padding: '3px 8px', fontSize: '10px', cursor: 'pointer' }}>{tag.name} ×</button>;
                    })}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <label style={label}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Brief project description..." style={{ ...inputStyle, resize: 'none' }} />
              </div>

              {form.id && (
                <div style={{ marginTop: '8px' }}>
                  <label style={label}>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="ui-select">
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              )}

              <div style={{ marginTop: '8px' }}>
                <label style={label}>Team Members</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {users.map((u) => (
                    <button key={u.id} type="button" onClick={() => {
                      const sel = form.member_ids.includes(u.id);
                      setForm({ ...form, member_ids: sel ? form.member_ids.filter((id) => id !== u.id) : [...form.member_ids, u.id] });
                    }} style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid', borderColor: form.member_ids.includes(u.id) ? '#f97316' : 'rgba(88,66,55,0.3)', background: form.member_ids.includes(u.id) ? 'rgba(249,115,22,0.15)' : 'transparent', color: form.member_ids.includes(u.id) ? '#ffb690' : 'rgba(167,139,125,0.6)', fontSize: '12px', cursor: 'pointer', transition: 'all 150ms' }}>
                      {u.nickname ? `${u.nickname} (${u.full_name})` : u.full_name}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(88,66,55,0.3)', fontSize: '14px', fontWeight: 600, color: 'rgba(167,139,125,0.6)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#f97316', border: 'none', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>{form.id ? 'Save Changes' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailsModal.open && (
        <div className="ui-overlay" style={{ zIndex: 100 }} onClick={() => setDetailsModal({ open: false, tab: 'tasks', project: null, tasks: [], notes: [], period: 'all' })}>
          <div className="ui-subwindow" style={{ ...card, width: 'min(920px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#ece0dc' }}>{detailsModal.project?.name}</h2>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(167,139,125,0.62)' }}>{detailsModal.project?.client_name || 'No client'}</p>
              </div>
              <button onClick={() => setDetailsModal({ open: false, tab: 'tasks', project: null, tasks: [], notes: [], period: 'all' })} style={{ border: 'none', background: 'transparent', color: 'rgba(167,139,125,0.72)', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              {tabs.map((tab) => (
                <button key={tab} onClick={() => setDetailsModal((p) => ({ ...p, tab }))} style={{ border: '1px solid rgba(88,66,55,0.34)', borderRadius: '8px', background: detailsModal.tab === tab ? 'rgba(249,115,22,0.14)' : 'transparent', color: detailsModal.tab === tab ? '#ffb690' : 'rgba(167,139,125,0.72)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', padding: '6px 10px', cursor: 'pointer' }}>{tab}</button>
              ))}
            </div>

            {detailsModal.tab === 'tasks' && (
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { key: '7d', label: 'Last 7 days' },
                    { key: '15d', label: 'Last 15 days' },
                    { key: '30d', label: 'Last 30 days' },
                    { key: '90d', label: 'Last 90 days' },
                    { key: 'all', label: 'All time' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setDetailsModal((prev) => ({ ...prev, period: opt.key }))}
                      style={{
                        border: '1px solid rgba(88,66,55,0.34)',
                        borderRadius: '14px',
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: detailsModal.period === opt.key ? 'rgba(249,115,22,0.16)' : 'transparent',
                        color: detailsModal.period === opt.key ? '#ffb690' : 'rgba(167,139,125,0.72)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(167,139,125,0.66)' }}>
                    {(() => {
                      const now = Date.now();
                      const periodDays = detailsModal.period === 'all' ? null : Number(detailsModal.period.replace('d', ''));
                      const list = (detailsModal.tasks || []).filter((task) => {
                        if (!periodDays) return true;
                        return new Date(task.created_at).getTime() >= (now - (periodDays * 24 * 3600 * 1000));
                      });
                      return `${list.length} results`;
                    })()}
                  </span>
                </div>

                {(() => {
                  const now = Date.now();
                  const periodDays = detailsModal.period === 'all' ? null : Number(detailsModal.period.replace('d', ''));
                  const taskList = (detailsModal.tasks || []).filter((task) => {
                    if (!periodDays) return true;
                    return new Date(task.created_at).getTime() >= (now - (periodDays * 24 * 3600 * 1000));
                  });
                  return taskList;
                })().length === 0 ? <div style={{ fontSize: '12px', color: 'rgba(167,139,125,0.65)' }}>No tasks in this period.</div> : (() => {
                  const now = Date.now();
                  const periodDays = detailsModal.period === 'all' ? null : Number(detailsModal.period.replace('d', ''));
                  return (detailsModal.tasks || []).filter((task) => {
                    if (!periodDays) return true;
                    return new Date(task.created_at).getTime() >= (now - (periodDays * 24 * 3600 * 1000));
                  }).map((task) => (
                  <div key={task.id} style={{ border: '1px solid rgba(88,66,55,0.26)', borderRadius: '8px', padding: '9px 10px', background: 'rgba(20,15,13,0.7)' }}>
                    <div style={{ fontSize: '12px', color: '#ece0dc', fontWeight: 700 }}>{task.title}</div>
                    <div style={{ marginTop: '3px', fontSize: '11px', color: 'rgba(167,139,125,0.62)' }}>{task.status.replace('_', ' ')} • {task.priority}</div>
                  </div>
                  ));
                })()}
              </div>
            )}

            {detailsModal.tab === 'canvas' && (
              <div style={{ fontSize: '12px', color: 'rgba(167,139,125,0.65)' }}>Canvas items are currently user-scoped. Project-shared canvas module can be added next.</div>
            )}

            {detailsModal.tab === 'notes' && (
              <div style={{ display: 'grid', gap: '8px' }}>
                {detailsModal.notes.length === 0 ? <div style={{ fontSize: '12px', color: 'rgba(167,139,125,0.65)' }}>No notes for this project.</div> : detailsModal.notes.map((note) => (
                  <div key={note.id} style={{ border: '1px solid rgba(88,66,55,0.26)', borderRadius: '8px', padding: '9px 10px', background: 'rgba(20,15,13,0.7)' }}>
                    <div style={{ fontSize: '12px', color: '#ece0dc', fontWeight: 700 }}>{note.title}</div>
                    <div style={{ marginTop: '3px', fontSize: '11px', color: 'rgba(167,139,125,0.62)' }}>{new Date(note.updated_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}

            {detailsModal.tab === 'details' && (
              <div style={{ display: 'grid', gap: '8px', fontSize: '12px', color: '#dfcbc1' }}>
                <div><strong>Project Tag:</strong> {detailsModal.project?.project_tag || '—'}</div>
                <div><strong>Client Tags:</strong> {(detailsModal.project?.client_tags || []).join(', ') || '—'}</div>
                <div><strong>Task Count:</strong> {detailsModal.project?.task_count || 0}</div>
                <div><strong>Lead Origin:</strong> {detailsModal.project?.lead_origin || 'Direct project'}</div>
                <div><strong>Status:</strong> {detailsModal.project?.status}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
