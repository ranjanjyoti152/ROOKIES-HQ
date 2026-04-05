import { useState, useEffect } from 'react';
import api from '../api/client';
import useAuthStore from '../store/authStore';
import {
  ArrowUpRight, ArrowDownRight, Eye, FolderOpen, CheckSquare, Clock, Zap,
  TrendingUp, Activity, Flame,
} from 'lucide-react';

const badgeColors = {
  unassigned:       { bg: 'rgba(88,66,55,0.3)',     color: '#a78b7d' },
  claimed:          { bg: 'rgba(249,115,22,0.15)',   color: '#ffb690' },
  editing:          { bg: 'rgba(251,191,36,0.13)',   color: '#fbbf24' },
  internal_review:  { bg: 'rgba(192,132,252,0.13)',  color: '#c084fc' },
  revision:         { bg: 'rgba(249,115,22,0.18)',   color: '#f97316' },
  delivered:        { bg: 'rgba(74,222,128,0.13)',   color: '#4ade80' },
  closed:           { bg: 'rgba(45,212,191,0.13)',   color: '#2dd4bf' },
};

function StatCard({ icon: Icon, label, value, trend, trendUp, color }) {
  return (
    <div style={{
      background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '14px',
      outline: '1px solid rgba(88,66,55,0.2)',
      padding: '20px 22px',
      transition: 'all 200ms cubic-bezier(0.4,0,0.2,1)',
      cursor: 'default',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#241e1c';
        e.currentTarget.style.outlineColor = 'rgba(249,115,22,0.22)';
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(15,10,8,0.4)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = '#201a18';
        e.currentTarget.style.outlineColor = 'rgba(88,66,55,0.2)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div style={{
          width: 34, height: 34, borderRadius: '10px',
          background: color || 'rgba(249,115,22,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color={color ? '#341100' : '#f97316'} strokeWidth={2} />
        </div>
        {trend && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            fontSize: '11px', fontWeight: 700,
            color: trendUp !== false ? '#4ade80' : '#f87171',
          }}>
            {trendUp !== false ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {trend}
          </span>
        )}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#f5ede8', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(167,139,125,0.6)', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
    </div>
  );
}

function HeatCell({ level }) {
  const styles = ['heat-low', 'heat-medium', 'heat-high', 'heat-full'];
  const cls = styles[Math.min(level, 3)];
  return (
    <div
      className={cls}
      style={{ width: 18, height: 18, transition: 'opacity 150ms' }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    />
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const firstName = user?.full_name?.split(' ')[0] || 'Rookie';

  const [stats, setStats] = useState({
    active_projects: 0, total_tasks: 0, completed_tasks: 0,
    total_time_logged: 0, efficiency_score: 0,
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/tasks/my-work'),
      api.get('/notifications?limit=5'),
      api.get('/analytics/heatmap'),
    ]).then(([statRes, taskRes, notifRes, heatmapRes]) => {
      setStats(statRes.data);
      setRecentTasks(taskRes.data.slice(0, 5));
      setActivities(notifRes.data.slice(0, 5));
      
      // Default fallback if map fails
      setHeatmapData(heatmapRes.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

      {/* ── Greeting ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{
            fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em',
            color: '#f5ede8', lineHeight: 1.2,
          }}>
            Hi, <span style={{ color: '#f97316' }}>{firstName}!</span>
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(167,139,125,0.7)', marginTop: '4px', fontWeight: 500 }}>
            Let's conquer today — {recentTasks.length > 0 ? `${recentTasks.length} tasks awaiting you.` : 'You\'re all caught up!'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
            color: 'rgba(249,115,22,0.6)', textTransform: 'uppercase',
            padding: '4px 10px', borderRadius: '9999px',
            background: 'rgba(249,115,22,0.08)',
          }}>
            <Flame size={10} style={{ display: 'inline', marginRight: 4 }} />
            Sprint Active
          </span>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <StatCard icon={FolderOpen}   label="Active Projects"  value={stats.active_projects}  trend="+2" trendUp />
        <StatCard icon={CheckSquare}  label="Tasks Completed"  value={stats.completed_tasks}  trend="+5" trendUp />
        <StatCard icon={Clock}        label="Hours Logged"     value={`${Math.round(stats.total_time_logged / 3600)}h`} />
        <StatCard icon={TrendingUp}   label="Efficiency Score" value={`${stats.efficiency_score}%`}
          trend={stats.efficiency_score > 60 ? `+${stats.efficiency_score - 60}%` : undefined} trendUp />
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Featured Banner */}
          <div style={{
            borderRadius: '14px', padding: '28px 30px', position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, #7c2d12 0%, #c2410c 40%, #f97316 75%, #fed7aa 100%)',
            boxShadow: '0 8px 32px rgba(249,115,22,0.3)',
          }}>
            <div style={{
              position: 'absolute', right: '-20px', top: '-20px',
              width: '160px', height: '160px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', right: '40px', bottom: '-30px',
              width: '100px', height: '100px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)', pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(52,17,0,0.6)', textTransform: 'uppercase', marginBottom: '8px' }}>
                🔥 Team Performance
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#341100', lineHeight: 1.3, marginBottom: '6px' }}>
                Maximize your team's productivity
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(52,17,0,0.65)', maxWidth: '320px', lineHeight: 1.5 }}>
                Track sprints, manage leads, and review performance — all in one place.
              </p>
            </div>
          </div>

          {/* Task Table */}
          <div style={{
            background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '14px',
            outline: '1px solid rgba(88,66,55,0.2)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(249,115,22,0.6)', textTransform: 'uppercase' }}>
                My Assigned Tasks
              </span>
              <button style={{
                fontSize: '11px', color: 'rgba(167,139,125,0.5)',
                background: 'none', border: 'none', cursor: 'pointer', transition: 'color 150ms',
              }}
                onMouseEnter={e => e.currentTarget.style.color = '#ffb690'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(167,139,125,0.5)'}
              >
                View all ›
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Task Name', 'Status', 'Deadline', 'Action'].map((h, i) => (
                    <th key={h} style={{
                      fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
                      color: 'rgba(88,66,55,0.55)', textTransform: 'uppercase',
                      padding: '10px 20px', textAlign: i === 3 ? 'right' : 'left',
                      borderBottom: '1px solid rgba(88,66,55,0.15)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center' }}>
                    <div className="skeleton" style={{ height: 12, width: 120, margin: '0 auto' }} />
                  </td></tr>
                ) : recentTasks.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: 'rgba(88,66,55,0.4)' }}>
                    No tasks yet — go claim something! 🚀
                  </td></tr>
                ) : recentTasks.map(task => {
                  const badge = badgeColors[task.status] || badgeColors.unassigned;
                  return (
                    <tr key={task.id}
                      style={{ transition: 'background 120ms', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(88,66,55,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '13px 20px', borderBottom: '1px solid rgba(88,66,55,0.1)', fontSize: '13px' }}>
                        <div style={{ fontWeight: 600, color: '#ece0dc' }}>{task.title}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(167,139,125,0.5)', marginTop: '2px' }}>
                          {task.task_type?.replace('_', ' ') || 'General'}
                        </div>
                      </td>
                      <td style={{ padding: '13px 20px', borderBottom: '1px solid rgba(88,66,55,0.1)' }}>
                        <span style={{
                          display: 'inline-block', padding: '3px 10px',
                          borderRadius: '9999px', fontSize: '10px', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          background: badge.bg, color: badge.color,
                        }}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '13px 20px', borderBottom: '1px solid rgba(88,66,55,0.1)', fontSize: '12px', color: 'rgba(167,139,125,0.55)' }}>
                        {task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '13px 20px', borderBottom: '1px solid rgba(88,66,55,0.1)', textAlign: 'right' }}>
                        {task.status === 'claimed' && (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#f97316', cursor: 'pointer', letterSpacing: '0.06em' }}>
                            START ›
                          </span>
                        )}
                        {task.status === 'editing' && (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', cursor: 'pointer' }}>LAUNCH</span>
                        )}
                        {task.status === 'internal_review' && (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontSize: '11px', color: 'rgba(88,66,55,0.4)' }}>
                            <Eye size={11} /> LOCKED
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Activity Metrics */}
          <div style={{ background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '14px', outline: '1px solid rgba(88,66,55,0.2)', padding: '18px 20px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(249,115,22,0.6)', textTransform: 'uppercase' }}>
              Activity Metrics
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
              {[
                { label: 'Hours Logged', value: (stats.total_time_logged / 3600).toFixed(1) },
                { label: 'Tasks Done', value: stats.completed_tasks },
              ].map(m => (
                <div key={m.label} style={{ background: '#2a2220', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(88,66,55,0.5)', textTransform: 'uppercase' }}>{m.label}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#f5ede8', marginTop: '6px' }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(88,66,55,0.5)', textTransform: 'uppercase' }}>Weekly Efficiency</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: stats.efficiency_score > 50 ? '#4ade80' : '#f97316' }}>
                  {stats.efficiency_score}%
                </span>
              </div>
              <div className="energy-track">
                <div className="energy-fill" style={{ width: `${stats.efficiency_score}%` }} />
              </div>
            </div>
          </div>

          {/* Weekly Activity Heatmap */}
          <div style={{ background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '14px', outline: '1px solid rgba(88,66,55,0.2)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(249,115,22,0.6)', textTransform: 'uppercase' }}>
                Weekly Activity
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {[['Low', 'heat-low'], ['Med', 'heat-medium'], ['High', 'heat-full']].map(([l, c]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div className={c} style={{ width: 8, height: 8 }} />
                    <span style={{ fontSize: '9px', color: 'rgba(88,66,55,0.5)', fontWeight: 600 }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {heatmapData.map(row => (
                <div key={row.day} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: 'rgba(88,66,55,0.4)', width: '22px', letterSpacing: '0.05em' }}>
                    {row.day}
                  </span>
                  {row.cells.map((level, i) => <HeatCell key={i} level={level} />)}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '14px', outline: '1px solid rgba(88,66,55,0.2)', padding: '18px 20px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(249,115,22,0.6)', textTransform: 'uppercase' }}>
              Recent Activity
            </span>
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activities.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'rgba(88,66,55,0.4)', textAlign: 'center', padding: '8px 0' }}>
                  No recent activity
                </div>
              ) : activities.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(249,115,22,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', fontWeight: 800, color: '#f97316', flexShrink: 0,
                  }}>
                    <Activity size={12} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#e0c0b1', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(88,66,55,0.5)', marginTop: '2px' }}>
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
