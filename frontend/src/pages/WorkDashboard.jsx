import { useState, useEffect } from 'react';
import api from '../api/client';
import { Briefcase, Building, CheckCircle2, Clock } from 'lucide-react';

const card = { background: '#0d0d14', border: '1px solid #1a1a28', borderRadius: '10px', padding: '24px' };
const label = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#5a5a70', textTransform: 'uppercase' };

const badgeColors = {
  active: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  paused: { bg: 'rgba(249,115,22,0.12)', color: '#f97316' },
  archived: { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af' },
};

export default function WorkDashboard() {
  const [projects, setProjects] = useState([]);
  const [statsMap, setStatsMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get('/projects');
        setProjects(res.data);
        
        // Fetch stats for all projects efficiently 
        const statsPromises = res.data.map(p => api.get(`/projects/${p.id}/stats`).catch(() => null));
        const statsResults = await Promise.all(statsPromises);
        
        const map = {};
        res.data.forEach((p, i) => {
          if (statsResults[i]) {
            map[p.id] = statsResults[i].data;
          }
        });
        setStatsMap(map);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const activeProjects = projects.filter(p => p.status === 'active');
  const uniqueClients = new Set(projects.map(p => p.client_name)).size;

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e0e0ec' }}>Work Dashboard</h1>
        <p style={{ fontSize: '13px', color: '#4a4a60', marginTop: '4px' }}>A high-level view of active client work and projects</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ ...card, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(45,95,223,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Briefcase size={16} style={{ color: '#2d5fdf' }} />
            </div>
            <span style={label}>Total Projects</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#e0e0ec' }}>{projects.length}</div>
        </div>

        <div style={{ ...card, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={16} style={{ color: '#a855f7' }} />
            </div>
            <span style={label}>Unique Clients</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#e0e0ec' }}>{uniqueClients}</div>
        </div>

        <div style={{ ...card, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
            </div>
            <span style={label}>Active Projects</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#e0e0ec' }}>{activeProjects.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {projects.map(project => {
          const stats = statsMap[project.id];
          const b = badgeColors[project.status] || badgeColors.archived;
          
          return (
            <div key={project.id} style={{ ...card, padding: '20px', transition: 'border-color 150ms' }}
                 onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a3a'}
                 onMouseLeave={e => e.currentTarget.style.borderColor = '#1a1a28'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#5a5a70', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    {project.client_name}
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#d0d0e0' }}>{project.name}</h3>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: b.bg, color: b.color }}>
                  {project.status}
                </span>
              </div>

              {stats ? (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'bottom', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#4a4a60' }}>Progress</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#e0e0ec' }}>
                        {stats.completion_percentage}%
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#151520', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        background: stats.completion_percentage === 100 ? '#22c55e' : '#2d5fdf',
                        width: `${stats.completion_percentage}%`,
                        borderRadius: '3px',
                        transition: 'width 1s ease-out'
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid #151520', paddingTop: '16px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#5a5a70', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '2px' }}>Total Tasks</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#c0c0d0' }}>{stats.total_tasks}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#5a5a70', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '2px' }}>Completed</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#c0c0d0' }}>{stats.completed_count}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#4a4a60' }}>Loading stats...</span>
                </div>
              )}
            </div>
          );
        })}
        {projects.length === 0 && !loading && (
          <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', background: '#0d0d14', border: '1px solid #1a1a28', borderRadius: '10px' }}>
            <Briefcase size={32} style={{ color: '#2a2a3a', margin: '0 auto 12px' }} />
            <div style={{ fontSize: '14px', color: '#c0c0d0' }}>No projects created yet.</div>
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
