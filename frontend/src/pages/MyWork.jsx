import { useState, useEffect } from 'react';
import api from '../api/client';
import { ClipboardList, Eye } from 'lucide-react';

const card = { background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px', overflow: 'hidden' };
const th = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(88,66,55,0.5)', textTransform: 'uppercase', padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid rgba(88,66,55,0.15)' };
const td = { padding: '12px 16px', borderBottom: '1px solid #111118', fontSize: '13px' };

const badgeColors = {
  unassigned: { bg: 'rgba(88,66,55,0.2)', color: 'rgba(167,139,125,0.6)' },
  claimed: { bg: 'rgba(249,115,22,0.12)', color: '#ffb690' },
  editing: { bg: 'rgba(234,179,8,0.12)', color: '#eab308' },
  internal_review: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  revision: { bg: 'rgba(249,115,22,0.12)', color: '#f97316' },
  delivered: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  closed: { bg: 'rgba(20,184,166,0.12)', color: '#14b8a6' },
};

const priorityDot = { urgent: '#ef4444', high: '#f97316', medium: '#f97316', low: 'rgba(88,66,55,0.6)' };

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

export default function MyWork() {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  useEffect(() => { api.get('/tasks/my-work').then(r => setTasks(r.data)).catch(() => {}); }, []);

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>My Work</h1>
        <p style={{ fontSize: '13px', color: 'rgba(88,66,55,0.6)', marginTop: '4px' }}>All tasks currently assigned to you</p>
      </div>

      <div style={card}>
        {tasks.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <ClipboardList size={40} style={{ color: 'rgba(88,66,55,0.5)', margin: '0 auto 14px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#e0c0b1', marginBottom: '6px' }}>No tasks assigned</h3>
            <p style={{ fontSize: '12px', color: 'rgba(88,66,55,0.5)' }}>Head to the Arena to claim some tasks!</p>
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
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ece0dc' }}>{t.title}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(88,66,55,0.6)', marginTop: '2px' }}>
                        Asset #{assetNumberFromId(t.id)}
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
                          background: priorityDot[t.priority] || 'rgba(88,66,55,0.6)', display: 'inline-block',
                        }} />
                        <span style={{ fontSize: '11px', color: 'rgba(167,139,125,0.6)', textTransform: 'capitalize' }}>{t.priority}</span>
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedTask(t)}
                        style={{
                        padding: '6px', borderRadius: '6px', background: 'none', border: 'none',
                        color: 'rgba(88,66,55,0.6)', cursor: 'pointer', transition: 'color 150ms'
                      }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ffb690'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(88,66,55,0.6)'}>
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

      {selectedTask && (
        <div
          className="ui-overlay"
          style={{ zIndex: 1200, padding: 16 }}
          onClick={() => setSelectedTask(null)}
        >
          <div className="ui-subwindow card" style={{ ...card, width: 'min(640px, 100%)', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, marginBottom: 8, fontSize: 17, color: '#ece0dc' }}>{selectedTask.title}</h3>
            <div style={{ fontSize: 12, color: 'rgba(167,139,125,0.68)', marginBottom: 12 }}>
              Status: <strong style={{ color: '#f5e8e1' }}>{selectedTask.status.replace('_', ' ')}</strong> • Priority: <strong style={{ color: '#f5e8e1' }}>{selectedTask.priority}</strong>
            </div>
            <div style={{ fontSize: 13, color: '#e0c0b1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {selectedTask.description || 'No description provided for this task.'}
            </div>
            {selectedTask.attachment_link && (
              <a
                href={selectedTask.attachment_link}
                target="_blank"
                rel="noreferrer"
                style={{
                  marginTop: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#ffb690',
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Open attachment
              </a>
            )}
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button
                onClick={() => setSelectedTask(null)}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
