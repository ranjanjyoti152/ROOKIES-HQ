import { useState, useEffect } from 'react';
import api from '../api/client';
import { ClipboardList, Eye } from 'lucide-react';

const card = { background: '#0d0d14', border: '1px solid #1a1a28', borderRadius: '10px', overflow: 'hidden' };
const th = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: '#3a3a50', textTransform: 'uppercase', padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid #151520' };
const td = { padding: '12px 16px', borderBottom: '1px solid #111118', fontSize: '13px' };

const badgeColors = {
  unassigned: { bg: '#1a1a28', color: '#6a6a80' },
  claimed: { bg: 'rgba(45,95,223,0.12)', color: '#5090ff' },
  editing: { bg: 'rgba(234,179,8,0.12)', color: '#eab308' },
  internal_review: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  revision: { bg: 'rgba(249,115,22,0.12)', color: '#f97316' },
  delivered: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  closed: { bg: 'rgba(20,184,166,0.12)', color: '#14b8a6' },
};

const priorityDot = { urgent: '#ef4444', high: '#f97316', medium: '#2d5fdf', low: '#4a4a60' };

export default function MyWork() {
  const [tasks, setTasks] = useState([]);
  useEffect(() => { api.get('/tasks/my-work').then(r => setTasks(r.data)).catch(() => {}); }, []);

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e0e0ec' }}>My Work</h1>
        <p style={{ fontSize: '13px', color: '#4a4a60', marginTop: '4px' }}>All tasks currently assigned to you</p>
      </div>

      <div style={card}>
        {tasks.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <ClipboardList size={40} style={{ color: '#2a2a3a', margin: '0 auto 14px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#c0c0d0', marginBottom: '6px' }}>No tasks assigned</h3>
            <p style={{ fontSize: '12px', color: '#3a3a50' }}>Head to the Arena to claim some tasks!</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Task Name</th>
                <th style={th}>Status</th>
                <th style={th}>Priority</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => {
                const b = badgeColors[t.status] || badgeColors.unassigned;
                return (
                  <tr key={t.id} style={{ transition: 'background 150ms' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#0f0f18'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={td}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#d0d0e0' }}>{t.title}</div>
                      <div style={{ fontSize: '11px', color: '#4a4a60', marginTop: '2px' }}>
                        Asset #{Math.floor(Math.random() * 9000 + 1000)}
                      </div>
                    </td>
                    <td style={td}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: '4px',
                        fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        background: b.bg, color: b.color,
                      }}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: priorityDot[t.priority] || '#4a4a60', display: 'inline-block',
                        }} />
                        <span style={{ fontSize: '11px', color: '#6a6a80', textTransform: 'capitalize' }}>{t.priority}</span>
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button style={{
                        padding: '6px', borderRadius: '6px', background: 'none', border: 'none',
                        color: '#4a4a60', cursor: 'pointer', transition: 'color 150ms'
                      }}
                        onMouseEnter={e => e.currentTarget.style.color = '#5090ff'}
                        onMouseLeave={e => e.currentTarget.style.color = '#4a4a60'}>
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
