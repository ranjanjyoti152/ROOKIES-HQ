import { useState, useEffect } from 'react';
import api from '../api/client';
import { Briefcase, Building, CheckCircle2, Clock } from 'lucide-react';

const card = { background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px', padding: '24px' };
const label = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(167,139,125,0.5)', textTransform: 'uppercase' };

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
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Work Dashboard</h1>
        <p style={{ fontSize: '13px', color: 'rgba(88,66,55,0.6)', marginTop: '4px' }}>A high-level view of active client work and projects</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ ...card, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Briefcase size={16} style={{ color: '#f97316' }} />
            </div>
            <span style={label}>Total Projects</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#ece0dc' }}>{projects.length}</div>
        </div>

        <div style={{ ...card, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={16} style={{ color: '#a855f7' }} />
            </div>
            <span style={label}>Unique Clients</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#ece0dc' }}>{uniqueClients}</div>
        </div>

        <div style={{ ...card, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
            </div>
            <span style={label}>Active Projects</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#ece0dc' }}>{activeProjects.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {projects.map(project => {
          const stats = statsMap[project.id];
          const b = badgeColors[project.status] || badgeColors.archived;
          
          return (
            <div key={project.id} style={{ ...card, padding: '20px', transition: 'border-color 150ms' }}
                 onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(88,66,55,0.5)'}
                 onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(88,66,55,0.2)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(167,139,125,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    {project.client_name}
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ece0dc' }}>{project.name}</h3>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: b.bg, color: b.color }}>
                  {project.status}
                </span>
              </div>

              {stats ? (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'bottom', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(88,66,55,0.6)' }}>Progress</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#ece0dc' }}>
                        {stats.completion_percentage}%
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(88,66,55,0.15)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        background: stats.completion_percentage === 100 ? '#22c55e' : '#f97316',
                        width: `${stats.completion_percentage}%`,
                        borderRadius: '3px',
                        transition: 'width 1s ease-out'
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid rgba(88,66,55,0.15)', paddingTop: '16px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'rgba(167,139,125,0.5)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '2px' }}>Total Tasks</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#e0c0b1' }}>{stats.total_tasks}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'rgba(167,139,125,0.5)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '2px' }}>Completed</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#e0c0b1' }}>{stats.completed_count}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(88,66,55,0.6)' }}>Loading stats...</span>
                </div>
              )}
            </div>
          );
        })}
        {projects.length === 0 && !loading && (
          <div style={{ gridColumn: '1 / -1', padding: '60px 20px', textAlign: 'center', background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px' }}>
            <Briefcase size={32} style={{ color: 'rgba(88,66,55,0.5)', margin: '0 auto 12px' }} />
            <div style={{ fontSize: '14px', color: '#e0c0b1' }}>No projects created yet.</div>
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
