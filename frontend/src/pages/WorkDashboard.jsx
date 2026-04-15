import { useMemo, useState, useEffect } from 'react';
import api from '../api/client';
import { Briefcase, Building, CheckCircle2, Clock, MessageSquare, PlayCircle } from 'lucide-react';

const card = {
  background: 'rgba(32, 26, 24, 0.55)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(88,66,55,0.2)',
  borderRadius: '10px',
  padding: '18px',
};

const statusStyles = {
  all: { bg: 'rgba(88,66,55,0.2)', color: 'rgba(167,139,125,0.7)' },
  active: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  revision: { bg: 'rgba(249,115,22,0.12)', color: '#f97316' },
  delivered: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
};

export default function WorkDashboard() {
  const [projects, setProjects] = useState([]);
  const [statsMap, setStatsMap] = useState({});
  const [projectId, setProjectId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get('/projects');
        const projectList = res.data || [];
        setProjects(projectList);
        if (!projectId && projectList[0]?.id) setProjectId(projectList[0].id);

        const statsPromises = projectList.map((p) => api.get(`/projects/${p.id}/stats`).catch(() => null));
        const statsResults = await Promise.all(statsPromises);
        const map = {};
        projectList.forEach((p, i) => {
          if (statsResults[i]) map[p.id] = statsResults[i].data;
        });
        setStatsMap(map);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!projectId) {
        setTasks([]);
        return;
      }
      try {
        const res = await api.get('/tasks', { params: { project_id: projectId } });
        setTasks(res.data || []);
      } catch {
        setTasks([]);
      }
    };
    fetchTasks();
  }, [projectId]);

  const selectedProject = projects.find((p) => p.id === projectId);
  const currentStats = statsMap[projectId] || { total_tasks: 0, short_form_count: 0, long_form_count: 0, revision_count: 0, completion_percentage: 0 };

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    if (statusFilter === 'active') return tasks.filter((t) => !['closed', 'delivered'].includes(t.status));
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const pendingFeedbackCount = tasks.filter((t) => t.status === 'revision').length;
  const awaitingReviewCount = tasks.filter((t) => t.status === 'delivered').length;

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Work Dashboard</h1>
          <p style={{ fontSize: '13px', color: 'rgba(88,66,55,0.6)', marginTop: '4px' }}>
            Primary execution board for editors and team members.
          </p>
        </div>

        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="ui-select" style={{ minWidth: '220px' }}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Briefcase size={16} style={{ color: '#f97316' }} />
            <span style={{ fontSize: '11px', color: 'rgba(167,139,125,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Short Form Uploaded</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 800, color: '#ece0dc' }}>{currentStats.short_form_count || 0}</div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building size={16} style={{ color: '#a855f7' }} />
            <span style={{ fontSize: '11px', color: 'rgba(167,139,125,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Long Form Uploaded</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 800, color: '#ece0dc' }}>{currentStats.long_form_count || 0}</div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageSquare size={16} style={{ color: '#f97316' }} />
            <span style={{ fontSize: '11px', color: 'rgba(167,139,125,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pending Revisions</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 800, color: '#f97316' }}>{pendingFeedbackCount}</div>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
            <span style={{ fontSize: '11px', color: 'rgba(167,139,125,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Project Completion</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 800, color: '#22c55e' }}>{currentStats.completion_percentage || 0}%</div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#ece0dc' }}>{selectedProject?.name || 'Tasks'}</div>
            <div style={{ fontSize: '11px', color: 'rgba(167,139,125,0.62)' }}>{awaitingReviewCount} completed videos awaiting review</div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['all', 'active', 'revision', 'delivered'].map((status) => {
              const style = statusStyles[status] || statusStyles.all;
              const active = statusFilter === status;
              return (
                <button key={status} onClick={() => setStatusFilter(status)} style={{ border: '1px solid rgba(88,66,55,0.3)', borderRadius: '16px', padding: '4px 10px', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, background: active ? style.bg : 'transparent', color: active ? style.color : 'rgba(167,139,125,0.72)', cursor: 'pointer' }}>
                  {status}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div style={{ fontSize: '12px', color: 'rgba(167,139,125,0.7)' }}>Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'rgba(167,139,125,0.7)' }}>No tasks for this filter.</div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {filteredTasks.map((task) => (
              <div key={task.id} style={{ border: '1px solid rgba(88,66,55,0.22)', borderRadius: '8px', padding: '10px 12px', background: 'rgba(20,15,13,0.7)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#ece0dc' }}>{task.title}</div>
                  <div style={{ marginTop: '2px', fontSize: '11px', color: 'rgba(167,139,125,0.62)' }}>
                    {task.status.replace('_', ' ')} • {task.priority}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: task.status === 'revision' ? '#f97316' : 'rgba(167,139,125,0.72)' }}>{task.status === 'revision' ? 'Revision Required' : 'On Track'}</span>
                  {(task.attachment_link || task.status === 'delivered') && (
                    <button onClick={() => window.location.assign('/client-portal')} style={{ border: 'none', borderRadius: '7px', background: 'rgba(249,115,22,0.14)', color: '#ffb690', fontSize: '11px', padding: '6px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <PlayCircle size={12} /> Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
