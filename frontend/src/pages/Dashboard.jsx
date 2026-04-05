import { useState, useEffect } from 'react';
import api from '../api/client';
import useAuthStore from '../store/authStore';
import { ArrowUpRight, Eye } from 'lucide-react';

const cardStyle = {
  background: '#0d0d14', border: '1px solid #1a1a28', borderRadius: '10px',
};
const labelStyle = {
  fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#3a3a50', textTransform: 'uppercase',
};
const headingStyle = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#2d5fdf', textTransform: 'uppercase',
};
const thStyle = {
  fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: '#3a3a50', textTransform: 'uppercase',
  padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid #151520',
};
const tdStyle = {
  padding: '12px 16px', borderBottom: '1px solid #111118', fontSize: '13px',
};

function StatCard({ label, value, trend }) {
  return (
    <div style={{ ...cardStyle, padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={labelStyle}>{label}</span>
        {trend && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', fontWeight: 700, color: '#22c55e' }}>
            <ArrowUpRight size={11} /> {trend}
          </span>
        )}
      </div>
      <span style={{ fontSize: '28px', fontWeight: 800, color: '#e0e0ec' }}>{value}</span>
    </div>
  );
}

const badgeColors = {
  unassigned: { bg: '#1a1a28', color: '#6a6a80' },
  claimed: { bg: 'rgba(45,95,223,0.12)', color: '#5090ff' },
  editing: { bg: 'rgba(234,179,8,0.12)', color: '#eab308' },
  internal_review: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  revision: { bg: 'rgba(249,115,22,0.12)', color: '#f97316' },
  delivered: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  closed: { bg: 'rgba(20,184,166,0.12)', color: '#14b8a6' },
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ projects: 0, tasks: 0, completed: 0 });
  const [recentTasks, setRecentTasks] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, taskRes] = await Promise.all([api.get('/projects'), api.get('/tasks')]);
        const tasks = taskRes.data;
        setStats({ projects: projRes.data.length, tasks: tasks.length, completed: tasks.filter(t => t.status === 'closed').length });
        setRecentTasks(tasks.slice(0, 6));
      } catch {}
    };
    fetchData();
  }, []);

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e0e0ec' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: '#4a4a60', marginTop: '4px' }}>
          Welcome back, {user?.full_name?.split(' ')[0]} — here's your overview
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        <StatCard label="Active Projects" value={stats.projects} trend="+2" />
        <StatCard label="Total Tasks" value={stats.tasks} />
        <StatCard label="Completed" value={stats.completed} trend="+5" />
        <StatCard label="Time Logged" value="—" />
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Task Table */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #151520' }}>
            <span style={headingStyle}>My Assigned Tasks</span>
            <button style={{ fontSize: '11px', color: '#3a3a50', background: 'none', border: 'none', cursor: 'pointer' }}>View All Archive</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Task Name</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Deadline</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentTasks.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#3a3a50', padding: '40px 16px' }}>
                    No tasks yet. Create your first project!
                  </td>
                </tr>
              ) : (
                recentTasks.map(task => {
                  const badge = badgeColors[task.status] || badgeColors.unassigned;
                  return (
                    <tr key={task.id} style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#0f0f18'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={tdStyle}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#d0d0e0' }}>{task.title}</div>
                        <div style={{ fontSize: '11px', color: '#3a3a50', marginTop: '2px' }}>
                          Asset #{Math.floor(Math.random() * 9000 + 1000)} • {task.task_type?.replace('_', ' ') || 'General'}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: '4px',
                          fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          background: badge.bg, color: badge.color,
                        }}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: '#6a6a80' }}>
                        {task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {task.status === 'claimed' && <span style={{ fontSize: '12px', fontWeight: 700, color: '#2d5fdf', cursor: 'pointer' }}>START EDITING</span>}
                        {task.status === 'editing' && <span style={{ fontSize: '12px', fontWeight: 700, color: '#eab308', cursor: 'pointer' }}>LAUNCH</span>}
                        {task.status === 'internal_review' && (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontSize: '12px', color: '#3a3a50' }}>LOCKED <Eye size={12} /></span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Activity Metrics */}
          <div style={{ ...cardStyle, padding: '16px 18px' }}>
            <span style={headingStyle}>Activity Metrics</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
              <div style={{ background: '#101018', border: '1px solid #151520', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#3a3a50', textTransform: 'uppercase' }}>Hours Logged</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#e0e0ec', marginTop: '6px' }}>32.4</div>
              </div>
              <div style={{ background: '#101018', border: '1px solid #151520', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#3a3a50', textTransform: 'uppercase' }}>Tasks Done</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#e0e0ec', marginTop: '6px' }}>{stats.completed}</div>
              </div>
            </div>
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #151520' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#3a3a50', textTransform: 'uppercase' }}>Weekly Efficiency</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#22c55e' }}>94%</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: '#151520', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: '94%', height: '100%', background: '#22c55e', borderRadius: '2px' }} />
              </div>
            </div>
          </div>

          {/* Arena Activity */}
          <div style={{ ...cardStyle, padding: '16px 18px' }}>
            <span style={headingStyle}>Arena Activity</span>
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { initials: 'SL', name: 'Sarah L.', action: 'just claimed', target: 'Project Redline' },
                { initials: 'DK', name: 'David K.', action: 'moved task to', target: 'Review' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#131320', border: '1px solid #1c1c2c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#5a5a70', flexShrink: 0 }}>
                    {item.initials}
                  </div>
                  <p style={{ fontSize: '12px', color: '#5a5a70', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600, color: '#c0c0d0' }}>{item.name}</span> {item.action}{' '}
                    <span style={{ color: '#2d5fdf' }}>{item.target}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
