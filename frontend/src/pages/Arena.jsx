import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import useAuthStore from '../store/authStore';
import useToastStore from '../store/toastStore';
import { Paperclip, Plus, Eye, MessageSquare } from 'lucide-react';

const card = { background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px' };
const heading = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#f97316', textTransform: 'uppercase' };
const label = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(88,66,55,0.5)', textTransform: 'uppercase' };
const th = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(88,66,55,0.5)', textTransform: 'uppercase', padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid rgba(88,66,55,0.15)' };
const td = { padding: '12px 16px', borderBottom: '1px solid #111118', fontSize: '13px' };

const badgeColors = {
  claimed: { bg: 'rgba(249,115,22,0.12)', color: '#ffb690' },
  editing: { bg: 'rgba(234,179,8,0.12)', color: '#eab308' },
  internal_review: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  revision: { bg: 'rgba(249,115,22,0.12)', color: '#f97316' },
  delivered: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
};
const typeColors = {
  short_form: { bg: 'rgba(6,182,212,0.12)', color: '#06b6d4' },
  long_form: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  vfx: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
};

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function assetNumberFromId(id) {
  const raw = String(id || '');
  const chars = raw.replace(/-/g, '');
  let hash = 0;
  for (let i = 0; i < chars.length; i += 1) {
    hash = ((hash << 5) - hash) + chars.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 9000) + 1000;
}

export default function Arena() {
  const navigate = useNavigate();
  const { pushToast } = useToastStore();
  const { user, fetchMe } = useAuthStore();
  const checkedIn = user?.is_checked_in || false;
  const [tasks, setTasks] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  const [reviewModal, setReviewModal] = useState({ open: false, taskId: null, link: '' });
  const [privateModal, setPrivateModal] = useState({ open: false, title: '', projectId: '' });

  const [stats, setStats] = useState({ 
    active_projects: 0, total_tasks: 0, completed_tasks: 0, 
    total_time_logged: 0, efficiency_score: 0, completion_rate: 0,
  });
  const [activities, setActivities] = useState([]);
  const [activeTime, setActiveTime] = useState("");
  const [logbookEntries, setLogbookEntries] = useState([]);

  useEffect(() => {
    if (user?.is_checked_in && user?.last_check_in) {
      const update = () => {
        const diff = Date.now() - new Date(user.last_check_in).getTime();
        const hrs = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setActiveTime(`${hrs}:${mins}:${secs}`);
      };
      update();
      const int = setInterval(update, 1000);
      return () => clearInterval(int);
    }
  }, [user?.is_checked_in, user?.last_check_in]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [personalRes, allRes, statRes, notifRes, projectRes, timeRes] = await Promise.all([
          api.get('/tasks/personal'),
          api.get('/tasks', { params: { status_filter: 'unassigned' } }),
          api.get('/analytics/dashboard'),
          api.get('/notifications?limit=5'),
          api.get('/projects'),
          api.get('/time-entries/report', { params: { days: 7, user_id: user?.id } }).catch(() => null),
        ]);
        setTasks(personalRes.data?.tasks || []);
        setLogbookEntries(personalRes.data?.logbook || []);
        setUnassigned(allRes.data);
        const dashboardStats = statRes.data || {};
        const reportEntry = timeRes?.data?.entries?.find((entry) => entry.user_id === user?.id)
          || timeRes?.data?.entries?.[0];
        const reportSeconds = asNumber(reportEntry?.total_seconds);
        const normalizedStats = {
          active_projects: asNumber(dashboardStats.active_projects),
          total_tasks: asNumber(dashboardStats.total_tasks),
          completed_tasks: asNumber(dashboardStats.completed_tasks),
          total_time_logged: asNumber(dashboardStats.total_time_logged, reportSeconds),
          completion_rate: asNumber(dashboardStats.completion_rate),
          efficiency_score: asNumber(
            dashboardStats.efficiency_score ?? dashboardStats.completion_rate
          ),
        };
        setStats(normalizedStats);
        setActivities(notifRes.data);
        setProjects(projectRes.data || []);
        setError('');
      } catch (err) {
        setError(err.response?.data?.detail || 'Unable to load Arena data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  const handleClaim = async (taskId) => {
    try {
      await api.post(`/tasks/${taskId}/claim`);
      setUnassigned(prev => prev.filter(t => t.id !== taskId));
      const res = await api.get('/tasks/personal');
      setTasks(res.data?.tasks || []);
      setLogbookEntries(res.data?.logbook || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to claim task.');
    }
  };

  const toggleCheckIn = async () => {
    try {
      await api.post('/users/me/checkin');
      await fetchMe();
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update check-in status.');
    }
  };

  const handleTransition = async (taskId, targetStatus, attachmentLink) => {
    try {
      const body = { target_status: targetStatus };
      if (attachmentLink) body.attachment_link = attachmentLink;
      await api.post(`/tasks/${taskId}/transition`, body);
      const res = await api.get('/tasks/personal');
      setTasks(res.data?.tasks || []);
      setLogbookEntries(res.data?.logbook || []);
      setError('');
      return true;
    } catch (err) {
      const message = err.response?.data?.detail || 'Transition failed';
      setError(message);
      pushToast({ type: 'error', title: 'Task transition failed', message });
      return false;
    }
  };

  const openSubmitModal = (taskId) => {
    setReviewModal({ open: true, taskId, link: '' });
  };

  const submitForReview = async () => {
    if (!reviewModal.link.trim()) {
      pushToast({ type: 'warning', title: 'Attachment required', message: 'Paste a review link before submitting.' });
      return;
    }
    const ok = await handleTransition(reviewModal.taskId, 'internal_review', reviewModal.link.trim());
    if (ok) {
      setReviewModal({ open: false, taskId: null, link: '' });
      pushToast({ type: 'success', title: 'Submitted for review', message: 'Task moved to Internal Review.' });
    }
  };

  const openPrivateTaskModal = () => {
    const defaultProject = projects.find((p) => p.status === 'active') || projects[0];
    if (!defaultProject) {
      pushToast({
        type: 'warning',
        title: 'Create a project first',
        message: 'Private tasks need a project context. Create one in Projects.',
      });
      navigate('/projects');
      return;
    }

    setPrivateModal({ open: true, title: '', projectId: defaultProject.id });
  };

  const createPrivateTask = async () => {
    if (!privateModal.title.trim()) {
      pushToast({ type: 'warning', title: 'Task title required', message: 'Please enter a private task title.' });
      return;
    }

    try {
      await api.post('/tasks', {
        project_id: privateModal.projectId,
        title: privateModal.title.trim(),
        description: 'Private focus task',
        assigned_user_id: user?.id,
        is_private: true,
      });
      const res = await api.get('/tasks/personal');
      setTasks(res.data?.tasks || []);
      setLogbookEntries(res.data?.logbook || []);
      setPrivateModal({ open: false, title: '', projectId: '' });
      pushToast({ type: 'success', title: 'Private task created', message: 'Added to your focus list.' });
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to create private task.';
      setError(message);
      pushToast({ type: 'error', title: 'Could not create private task', message });
    }
  };

  const activeTasks = tasks.filter(t => !['closed'].includes(t.status) && !t.is_private);
  const privateTasks = tasks.filter(t => t.is_private);
  const archivedTasks = logbookEntries;
  const hoursLogged = asNumber(stats.total_time_logged) / 3600;
  const tasksDone = Math.max(0, Math.floor(asNumber(stats.completed_tasks)));
  const efficiencyScore = Math.max(
    0,
    Math.min(100, asNumber(stats.efficiency_score || stats.completion_rate))
  );
  const efficiencyColor = efficiencyScore > 50 ? '#22c55e' : '#f97316';

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {loading && (
        <div style={{ ...card, padding: '16px', marginBottom: '16px', fontSize: '12px', color: 'rgba(167,139,125,0.7)' }}>
          Loading Arena data...
        </div>
      )}
      {error && (
        <div style={{ ...card, padding: '16px', marginBottom: '16px', fontSize: '12px', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc', marginBottom: '4px' }}>The Arena</h1>
          <p style={{ fontSize: '13px', color: 'rgba(88,66,55,0.6)' }}>Active workspace for <span style={{ color: 'rgba(167,139,125,0.7)' }}>@{(user?.nickname || user?.full_name || '').toLowerCase().replace(' ', '_')}</span></p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {checkedIn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ece0dc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Checked In</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#f5ede8' }}>Session {activeTime}</span>
            </div>
          )}
          <button onClick={toggleCheckIn} style={{
            padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms',
            background: checkedIn ? '#f97316' : 'transparent',
            border: checkedIn ? 'none' : '1px solid rgba(88,66,55,0.3)',
            color: checkedIn ? 'white' : 'rgba(167,139,125,0.6)',
          }}>
            {checkedIn ? 'CHECK OUT' : 'CHECK IN'}
          </button>
        </div>
      </div>

      {/* 3-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Quick Claim */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(88,66,55,0.15)' }}>
              <span style={heading}>Quick Claim</span>
              <span style={{ fontSize: '11px', color: 'rgba(88,66,55,0.5)' }}>{unassigned.length} Available</span>
            </div>
            {unassigned.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(88,66,55,0.6)', fontSize: '13px' }}>All tasks have been claimed!</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px' }}>
                {unassigned.slice(0, 4).map(task => {
                  const tc = typeColors[task.task_type] || typeColors.short_form;
                  return (
                    <div key={task.id} style={{ background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.15)', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: tc.bg, color: tc.color }}>
                          {task.task_type?.replace('_', ' ') || 'General'}
                        </span>
                        {task.deadline && <span style={{ fontSize: '11px', color: 'rgba(88,66,55,0.6)' }}>Due in {Math.ceil((new Date(task.deadline) - new Date()) / 3600000)}h</span>}
                      </div>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#ece0dc', marginBottom: '6px' }}>{task.title}</h3>
                      <p style={{ fontSize: '12px', color: 'rgba(167,139,125,0.5)', lineHeight: 1.5, marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {task.description || 'Apply grain texture and color matching for the final sequence. 4K ProRes 444...'}
                      </p>
                      <button onClick={() => handleClaim(task.id)} style={{
                        width: '100%', padding: '10px', borderRadius: '6px', background: 'transparent',
                        border: '1px solid rgba(88,66,55,0.3)', fontSize: '12px', fontWeight: 700, color: 'rgba(167,139,125,0.6)',
                        cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 150ms'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ece0dc'; e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.background = 'rgba(249,115,22,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'rgba(167,139,125,0.6)'; e.currentTarget.style.borderColor = 'rgba(88,66,55,0.3)'; e.currentTarget.style.background = 'transparent'; }}>
                        Claim Task
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* My Assigned Tasks Table */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(88,66,55,0.15)' }}>
              <span style={heading}>My Assigned Tasks</span>
              <button
                onClick={() => setShowArchive((v) => !v)}
                style={{ fontSize: '11px', color: 'rgba(88,66,55,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {showArchive ? 'Hide Archive' : `View Archive (${archivedTasks.length})`}
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Task Name</th>
                  <th style={th}>Status</th>
                  <th style={th}>Deadline</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeTasks.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: 'rgba(88,66,55,0.5)', padding: '36px 16px' }}>No assigned tasks. Claim one above!</td></tr>
                ) : (
                  activeTasks.map(task => {
                    const b = badgeColors[task.status] || { bg: 'rgba(88,66,55,0.2)', color: 'rgba(167,139,125,0.6)' };
                    return (
                      <tr key={task.id}
                        onMouseEnter={e => e.currentTarget.style.background = '#0f0f18'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={td}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#ece0dc' }}>{task.title}</div>
                          <div style={{ fontSize: '11px', color: 'rgba(88,66,55,0.5)', marginTop: '2px' }}>Asset #{assetNumberFromId(task.id)} • {task.task_type?.replace('_',' ') || 'Edit'}</div>
                        </td>
                        <td style={td}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: b.bg, color: b.color }}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ ...td, color: 'rgba(167,139,125,0.5)' }}>{task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {task.status === 'claimed' && (
                            <button onClick={() => handleTransition(task.id, 'editing')} style={{ background: 'none', border: 'none', fontSize: '12px', fontWeight: 700, color: '#f97316', cursor: 'pointer', textTransform: 'uppercase' }}>Start Editing</button>
                          )}
                          {task.status === 'editing' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                              <button onClick={() => openSubmitModal(task.id)}
                                style={{ background: 'none', border: 'none', fontSize: '12px', fontWeight: 700, color: '#eab308', cursor: 'pointer', textTransform: 'uppercase' }}>Submit</button>
                              <Paperclip size={13} style={{ color: 'rgba(88,66,55,0.5)' }} />
                            </div>
                          )}
                          {task.status === 'revision' && (
                            <button onClick={() => handleTransition(task.id, 'editing')} style={{ background: 'none', border: 'none', fontSize: '12px', fontWeight: 700, color: '#f97316', cursor: 'pointer', textTransform: 'uppercase' }}>Resume</button>
                          )}
                          {task.status === 'internal_review' && (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontSize: '12px', color: 'rgba(88,66,55,0.5)' }}>LOCKED <Eye size={12} /></span>
                          )}
                          {task.status === 'delivered' && (
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase' }}>Delivered</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {showArchive && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(88,66,55,0.15)' }}>
                <span style={heading}>Archived Tasks</span>
                <span style={{ fontSize: '11px', color: 'rgba(88,66,55,0.5)' }}>{archivedTasks.length} Closed</span>
              </div>
              {archivedTasks.length === 0 ? (
                <div style={{ padding: '20px 16px', fontSize: '12px', color: 'rgba(167,139,125,0.6)' }}>No archived tasks yet.</div>
              ) : (
                <div style={{ padding: '10px 16px 14px', display: 'grid', gap: '8px' }}>
                  {archivedTasks.map((task) => (
                    <div key={task.id} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(88,66,55,0.2)', background: 'rgba(24,18,16,0.5)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#e8dbd4' }}>{task.title}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(167,139,125,0.58)', marginTop: '2px' }}>
                        Completed {new Date(task.completed_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Activity Metrics */}
          <div style={{ ...card, padding: '16px 18px' }}>
            <span style={heading}>Activity Metrics</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
              <div style={{ background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.15)', borderRadius: '8px', padding: '14px' }}>
                <div style={label}>Hours Logged</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#ece0dc', marginTop: '6px' }}>{hoursLogged.toFixed(1)}</div>
              </div>
              <div style={{ background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.15)', borderRadius: '8px', padding: '14px' }}>
                <div style={label}>Tasks Done</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#ece0dc', marginTop: '6px' }}>{tasksDone}</div>
              </div>
            </div>
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(88,66,55,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={label}>Weekly Efficiency</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: efficiencyColor }}>{efficiencyScore}%</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(88,66,55,0.15)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${efficiencyScore}%`, height: '100%', background: efficiencyColor, borderRadius: '2px', transition: 'width 1s ease-out' }} />
              </div>
            </div>
          </div>

          {/* Private Focus */}
          <div style={{ ...card, padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={heading}>Private Focus</span>
              <button
                onClick={openPrivateTaskModal}
                style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f97316', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                title="Create private focus task"
              >
                <Plus size={12} style={{ color: 'white' }} />
              </button>
            </div>
            {privateTasks.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'rgba(167,139,125,0.5)', padding: '10px 0', textAlign: 'center' }}>No private tasks.</div>
            ) : (
              privateTasks.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: i < privateTasks.length - 1 ? '12px' : 0 }}>
                  <input type="checkbox" checked={item.status === 'closed'}
                    onChange={(e) => handleTransition(item.id, e.target.checked ? 'closed' : 'claimed')}
                    style={{ width: '15px', height: '15px', marginTop: '2px', accentColor: '#f97316', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: item.status === 'closed' ? 'rgba(88,66,55,0.5)' : '#e0c0b1', textDecoration: item.status === 'closed' ? 'line-through' : 'none' }}>{item.title}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(88,66,55,0.5)', marginTop: '2px' }}>{item.task_type?.replace('_', ' ') || 'Personal'}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Arena Activity */}
          <div style={{ ...card, padding: '16px 18px' }}>
            <span style={heading}>Arena Activity</span>
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activities.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'rgba(167,139,125,0.5)', padding: '10px 0', textAlign: 'center' }}>No recent activity.</div>
              ) : (
                activities.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#2f2926', border: '1px solid rgba(88,66,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'rgba(167,139,125,0.5)', flexShrink: 0 }}>
                      {'SYS'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '12px', color: 'rgba(167,139,125,0.5)', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: '#e0c0b1' }}>{item.title}</span>
                      </p>
                      <p style={{ fontSize: '11px', color: 'rgba(88,66,55,0.6)', marginTop: '2px' }}>{item.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat FAB */}
      <button
        onClick={() => setShowQuickActions((v) => !v)}
        style={{
        position: 'fixed', bottom: '24px', right: '24px', width: '44px', height: '44px', borderRadius: '50%',
        background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(88,66,55,0.6)', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        <MessageSquare size={18} />
      </button>

      {showQuickActions && (
        <div className="ui-menu" style={{
          position: 'fixed',
          bottom: '76px',
          right: '24px',
          width: 220,
          animation: 'scaleIn 150ms ease-out',
          zIndex: 20,
        }}>
          {[
            { label: 'Open Notifications', path: '/notifications' },
            { label: 'Go To My Work', path: '/my-work' },
            { label: 'Open Canvas', path: '/canvas' },
          ].map((action) => (
            <button
              key={action.path}
              onClick={() => {
                setShowQuickActions(false);
                navigate(action.path);
              }}
              className="ui-menu-item"
              style={{ fontSize: 12, textAlign: 'left' }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {reviewModal.open && (
        <div className="ui-overlay" style={{ zIndex: 30, padding: 16 }} onClick={() => setReviewModal({ open: false, taskId: null, link: '' })}>
          <div className="ui-subwindow" style={{ ...card, width: 'min(520px, 100%)', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ece0dc', marginBottom: 10 }}>Submit For Internal Review</div>
            <div style={{ fontSize: 12, color: 'rgba(167,139,125,0.68)', marginBottom: 12 }}>
              Paste the delivery/review link to move this task to <strong>Internal Review</strong>.
            </div>
            <input
              value={reviewModal.link}
              onChange={(e) => setReviewModal((prev) => ({ ...prev, link: e.target.value }))}
              placeholder="https://drive.google.com/..."
              style={{
                width: '100%',
                borderRadius: 9,
                border: '1px solid rgba(88,66,55,0.35)',
                background: '#2f2926',
                color: '#eee0d8',
                fontSize: 13,
                padding: '10px 12px',
                outline: 'none',
              }}
            />
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setReviewModal({ open: false, taskId: null, link: '' })}
                style={{ border: '1px solid rgba(88,66,55,0.32)', background: 'transparent', color: 'rgba(167,139,125,0.7)', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={submitForReview}
                style={{ border: 'none', background: '#f97316', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {privateModal.open && (
        <div className="ui-overlay" style={{ zIndex: 30, padding: 16 }} onClick={() => setPrivateModal({ open: false, title: '', projectId: '' })}>
          <div className="ui-subwindow" style={{ ...card, width: 'min(520px, 100%)', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ece0dc', marginBottom: 12 }}>Create Private Focus Task</div>
            <div style={{ display: 'grid', gap: 10 }}>
              <input
                value={privateModal.title}
                onChange={(e) => setPrivateModal((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Example: Draft alt cut for intro sequence"
                style={{
                  width: '100%',
                  borderRadius: 9,
                  border: '1px solid rgba(88,66,55,0.35)',
                  background: '#2f2926',
                  color: '#eee0d8',
                  fontSize: 13,
                  padding: '10px 12px',
                  outline: 'none',
                }}
              />
              <select
                value={privateModal.projectId}
                onChange={(e) => setPrivateModal((prev) => ({ ...prev, projectId: e.target.value }))}
                className="ui-select"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setPrivateModal({ open: false, title: '', projectId: '' })}
                style={{ border: '1px solid rgba(88,66,55,0.32)', background: 'transparent', color: 'rgba(167,139,125,0.7)', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={createPrivateTask}
                style={{ border: 'none', background: '#f97316', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
