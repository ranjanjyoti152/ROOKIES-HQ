import { useState, useEffect } from 'react';
import api from '../api/client';
import useAuthStore from '../store/authStore';
import { Play, Paperclip, Plus, Eye, MessageSquare } from 'lucide-react';

const card = { background: '#0d0d14', border: '1px solid #1a1a28', borderRadius: '10px' };
const heading = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#2d5fdf', textTransform: 'uppercase' };
const label = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#3a3a50', textTransform: 'uppercase' };
const th = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: '#3a3a50', textTransform: 'uppercase', padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid #151520' };
const td = { padding: '12px 16px', borderBottom: '1px solid #111118', fontSize: '13px' };

const badgeColors = {
  claimed: { bg: 'rgba(45,95,223,0.12)', color: '#5090ff' },
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

export default function Arena() {
  const { user, fetchMe } = useAuthStore();
  const checkedIn = user?.is_checked_in || false;
  const [tasks, setTasks] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ 
    active_projects: 0, total_tasks: 0, completed_tasks: 0, 
    total_time_logged: 0, efficiency_score: 0 
  });
  const [activities, setActivities] = useState([]);
  const [activeTime, setActiveTime] = useState("");

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
        const [myRes, allRes, statRes, notifRes] = await Promise.all([
          api.get('/tasks/my-work'),
          api.get('/tasks', { params: { status_filter: 'unassigned' } }),
          api.get('/analytics/dashboard'),
          api.get('/notifications?limit=5'),
        ]);
        setTasks(myRes.data);
        setUnassigned(allRes.data);
        setStats(statRes.data);
        setActivities(notifRes.data);
      } catch {} finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const handleClaim = async (taskId) => {
    try {
      await api.post(`/tasks/${taskId}/claim`);
      setUnassigned(prev => prev.filter(t => t.id !== taskId));
      const res = await api.get('/tasks/my-work');
      setTasks(res.data);
    } catch {}
  };

  const toggleCheckIn = async () => {
    try {
      await api.post('/users/me/checkin');
      await fetchMe();
    } catch {}
  };

  const handleTransition = async (taskId, targetStatus, attachmentLink) => {
    try {
      const body = { target_status: targetStatus };
      if (attachmentLink) body.attachment_link = attachmentLink;
      await api.post(`/tasks/${taskId}/transition`, body);
      const res = await api.get('/tasks/my-work');
      setTasks(res.data);
    } catch (err) { alert(err.response?.data?.detail || 'Transition failed'); }
  };

  const activeTasks = tasks.filter(t => !['closed'].includes(t.status) && !t.is_private);
  const privateTasks = tasks.filter(t => t.is_private);

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e0e0ec', marginBottom: '4px' }}>The Arena</h1>
          <p style={{ fontSize: '13px', color: '#4a4a60' }}>Active workspace for <span style={{ color: '#8080a0' }}>@{user?.full_name?.toLowerCase().replace(' ', '_')}</span></p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {checkedIn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#d0d0e0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Checked In</span>
              <span style={{ fontSize: '11px', color: '#3a3a50' }}>Session {activeTime}</span>
            </div>
          )}
          <button onClick={toggleCheckIn} style={{
            padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms',
            background: checkedIn ? '#2d5fdf' : 'transparent',
            border: checkedIn ? 'none' : '1px solid #1c1c2c',
            color: checkedIn ? 'white' : '#6a6a80',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #151520' }}>
              <span style={heading}>Quick Claim</span>
              <span style={{ fontSize: '11px', color: '#3a3a50' }}>{unassigned.length} Available</span>
            </div>
            {unassigned.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#4a4a60', fontSize: '13px' }}>All tasks have been claimed!</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px' }}>
                {unassigned.slice(0, 4).map(task => {
                  const tc = typeColors[task.task_type] || typeColors.short_form;
                  return (
                    <div key={task.id} style={{ background: '#101018', border: '1px solid #151520', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: tc.bg, color: tc.color }}>
                          {task.task_type?.replace('_', ' ') || 'General'}
                        </span>
                        {task.deadline && <span style={{ fontSize: '11px', color: '#4a4a60' }}>Due in {Math.ceil((new Date(task.deadline) - new Date()) / 3600000)}h</span>}
                      </div>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d0d0e0', marginBottom: '6px' }}>{task.title}</h3>
                      <p style={{ fontSize: '12px', color: '#5a5a70', lineHeight: 1.5, marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {task.description || 'Apply grain texture and color matching for the final sequence. 4K ProRes 444...'}
                      </p>
                      <button onClick={() => handleClaim(task.id)} style={{
                        width: '100%', padding: '10px', borderRadius: '6px', background: 'transparent',
                        border: '1px solid #1c1c2c', fontSize: '12px', fontWeight: 700, color: '#6a6a80',
                        cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 150ms'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#e0e0ec'; e.currentTarget.style.borderColor = '#2d5fdf'; e.currentTarget.style.background = 'rgba(45,95,223,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#6a6a80'; e.currentTarget.style.borderColor = '#1c1c2c'; e.currentTarget.style.background = 'transparent'; }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #151520' }}>
              <span style={heading}>My Assigned Tasks</span>
              <button style={{ fontSize: '11px', color: '#3a3a50', background: 'none', border: 'none', cursor: 'pointer' }}>View All Archive</button>
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
                  <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#3a3a50', padding: '36px 16px' }}>No assigned tasks. Claim one above!</td></tr>
                ) : (
                  activeTasks.map(task => {
                    const b = badgeColors[task.status] || { bg: '#1a1a28', color: '#6a6a80' };
                    return (
                      <tr key={task.id}
                        onMouseEnter={e => e.currentTarget.style.background = '#0f0f18'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={td}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#d0d0e0' }}>{task.title}</div>
                          <div style={{ fontSize: '11px', color: '#3a3a50', marginTop: '2px' }}>Asset #{Math.floor(Math.random()*9000+1000)} • {task.task_type?.replace('_',' ') || 'Edit'}</div>
                        </td>
                        <td style={td}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: b.bg, color: b.color }}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ ...td, color: '#5a5a70' }}>{task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {task.status === 'claimed' && (
                            <button onClick={() => handleTransition(task.id, 'editing')} style={{ background: 'none', border: 'none', fontSize: '12px', fontWeight: 700, color: '#2d5fdf', cursor: 'pointer', textTransform: 'uppercase' }}>Start Editing</button>
                          )}
                          {task.status === 'editing' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                              <button onClick={() => { const link = prompt('Paste attachment link:'); if (link) handleTransition(task.id, 'internal_review', link); }}
                                style={{ background: 'none', border: 'none', fontSize: '12px', fontWeight: 700, color: '#eab308', cursor: 'pointer', textTransform: 'uppercase' }}>Submit</button>
                              <Paperclip size={13} style={{ color: '#3a3a50' }} />
                            </div>
                          )}
                          {task.status === 'revision' && (
                            <button onClick={() => handleTransition(task.id, 'editing')} style={{ background: 'none', border: 'none', fontSize: '12px', fontWeight: 700, color: '#f97316', cursor: 'pointer', textTransform: 'uppercase' }}>Resume</button>
                          )}
                          {task.status === 'internal_review' && (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontSize: '12px', color: '#3a3a50' }}>LOCKED <Eye size={12} /></span>
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
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Activity Metrics */}
          <div style={{ ...card, padding: '16px 18px' }}>
            <span style={heading}>Activity Metrics</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
              <div style={{ background: '#101018', border: '1px solid #151520', borderRadius: '8px', padding: '14px' }}>
                <div style={label}>Hours Logged</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#e0e0ec', marginTop: '6px' }}>{(stats.total_time_logged / 3600).toFixed(1)}</div>
              </div>
              <div style={{ background: '#101018', border: '1px solid #151520', borderRadius: '8px', padding: '14px' }}>
                <div style={label}>Tasks Done</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#e0e0ec', marginTop: '6px' }}>{stats.completed_tasks}</div>
              </div>
            </div>
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #151520' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={label}>Weekly Efficiency</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: stats.efficiency_score > 50 ? '#22c55e' : '#f97316' }}>{stats.efficiency_score}%</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: '#151520', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${stats.efficiency_score}%`, height: '100%', background: stats.efficiency_score > 50 ? '#22c55e' : '#f97316', borderRadius: '2px', transition: 'width 1s ease-out' }} />
              </div>
            </div>
          </div>

          {/* Private Focus */}
          <div style={{ ...card, padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={heading}>Private Focus</span>
              <button style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#2d5fdf', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Plus size={12} style={{ color: 'white' }} />
              </button>
            </div>
            {privateTasks.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#5a5a70', padding: '10px 0', textAlign: 'center' }}>No private tasks.</div>
            ) : (
              privateTasks.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: i < privateTasks.length - 1 ? '12px' : 0 }}>
                  <input type="checkbox" defaultChecked={item.status === 'closed'}
                    onChange={(e) => handleTransition(item.id, e.target.checked ? 'closed' : 'unassigned')}
                    style={{ width: '15px', height: '15px', marginTop: '2px', accentColor: '#2d5fdf', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: item.status === 'closed' ? '#3a3a50' : '#c0c0d0', textDecoration: item.status === 'closed' ? 'line-through' : 'none' }}>{item.title}</div>
                    <div style={{ fontSize: '10px', color: '#3a3a50', marginTop: '2px' }}>{item.task_type?.replace('_', ' ') || 'Personal'}</div>
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
                <div style={{ fontSize: '12px', color: '#5a5a70', padding: '10px 0', textAlign: 'center' }}>No recent activity.</div>
              ) : (
                activities.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#131320', border: '1px solid #1c1c2c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#5a5a70', flexShrink: 0 }}>
                      {'SYS'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '12px', color: '#5a5a70', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: '#c0c0d0' }}>{item.title}</span>
                      </p>
                      <p style={{ fontSize: '11px', color: '#4a4a60', marginTop: '2px' }}>{item.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat FAB */}
      <button style={{
        position: 'fixed', bottom: '24px', right: '24px', width: '44px', height: '44px', borderRadius: '50%',
        background: '#0d0d14', border: '1px solid #1a1a28', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#4a4a60', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        <MessageSquare size={18} />
      </button>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
