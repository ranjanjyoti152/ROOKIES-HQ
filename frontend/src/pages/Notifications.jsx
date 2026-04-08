import { useState, useEffect } from 'react';
import api from '../api/client';
import { Bell, Check, CheckCheck } from 'lucide-react';

const card = { background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px', overflow: 'hidden' };

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  
  const fetchNotifs = () => api.get('/notifications')
    .then((r) => {
      setNotifications(r.data);
      setError('');
    })
    .catch((err) => {
      setError(err.response?.data?.detail || 'Unable to load notifications.');
    });
  useEffect(() => { fetchNotifs(); }, []);

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(p => p.map(n => n.id === id ? { ...n, is_read: true } : n));
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to mark notification as read.');
    }
  };
  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(p => p.map(n => ({ ...n, is_read: true })));
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to mark notifications as read.');
    }
  };

  const handleAssignAction = async (notifId, projectId, action) => {
    try {
      await api.post(`/projects/${projectId}/members/${action}`);
      await markRead(notifId);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out', maxWidth: '672px' }}>
      {error && (
        <div style={{ ...card, padding: '12px 14px', marginBottom: '12px', fontSize: '12px', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Notifications</h1>
        <button onClick={markAllRead} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px',
          background: 'none', border: 'none', color: '#ffb690', fontSize: '11px', fontWeight: 700, 
          textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 150ms'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.12)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <CheckCheck size={14} /> Mark all read
        </button>
      </div>

      <div style={card}>
        {notifications.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Bell size={40} style={{ color: 'rgba(88,66,55,0.5)', margin: '0 auto 14px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#e0c0b1', marginBottom: '6px' }}>No notifications</h3>
            <p style={{ fontSize: '12px', color: 'rgba(88,66,55,0.5)' }}>You're all caught up!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map(n => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 20px',
                borderBottom: '1px solid rgba(88,66,55,0.15)', transition: 'background 150ms',
                background: !n.is_read ? 'rgba(45,95,223,0.05)' : 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.background = !n.is_read ? 'rgba(249,115,22,0.08)' : '#0f0f18'}
              onMouseLeave={e => e.currentTarget.style.background = !n.is_read ? 'rgba(45,95,223,0.05)' : 'transparent'}>
                
                {/* Unread indicator */}
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
                  background: !n.is_read ? '#f97316' : 'transparent',
                }} />
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: !n.is_read ? 600 : 500, color: !n.is_read ? '#ece0dc' : '#ece0dc', marginBottom: '4px' }}>{n.title}</p>
                  {n.message && <p style={{ fontSize: '12px', color: 'rgba(167,139,125,0.6)', marginBottom: '6px', lineHeight: 1.4 }}>{n.message}</p>}
                  
                  {n.type === 'project_assignment' && !n.is_read && n.reference_id && (
                    <div style={{ display: 'flex', gap: '8px', margin: '8px 0 10px' }}>
                      <button onClick={(e) => { e.stopPropagation(); handleAssignAction(n.id, n.reference_id, 'accept'); }} style={{
                        padding: '6px 12px', borderRadius: '4px', background: '#ea580c', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'background 150ms'
                      }} onMouseEnter={e => e.currentTarget.style.background = '#f97316'} onMouseLeave={e => e.currentTarget.style.background = '#ea580c'}>Accept Project</button>
                      
                      <button onClick={(e) => { e.stopPropagation(); handleAssignAction(n.id, n.reference_id, 'reject'); }} style={{
                        padding: '6px 12px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'background 150ms'
                      }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}>Decline</button>
                    </div>
                  )}

                  <p style={{ fontSize: '10px', color: 'rgba(88,66,55,0.6)' }}>{new Date(n.created_at).toLocaleString()}</p>
                </div>

                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} style={{
                    padding: '6px', borderRadius: '6px', background: 'none', border: 'none',
                    color: 'rgba(88,66,55,0.6)', cursor: 'pointer', transition: 'all 150ms'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ffb690'; e.currentTarget.style.background = 'rgba(249,115,22,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(88,66,55,0.6)'; e.currentTarget.style.background = 'none'; }}>
                    <Check size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
