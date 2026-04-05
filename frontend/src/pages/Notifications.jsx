import { useState, useEffect } from 'react';
import api from '../api/client';
import { Bell, Check, CheckCheck } from 'lucide-react';

const card = { background: '#0d0d14', border: '1px solid #1a1a28', borderRadius: '10px', overflow: 'hidden' };

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  
  const fetchNotifs = () => api.get('/notifications').then(r => setNotifications(r.data)).catch(() => {});
  useEffect(() => { fetchNotifs(); }, []);

  const markRead = async (id) => { try { await api.post(`/notifications/${id}/read`); setNotifications(p => p.map(n => n.id===id?{...n,is_read:true}:n)); } catch {} };
  const markAllRead = async () => { try { await api.post('/notifications/read-all'); setNotifications(p => p.map(n => ({...n,is_read:true}))); } catch {} };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out', maxWidth: '672px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e0e0ec' }}>Notifications</h1>
        <button onClick={markAllRead} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px',
          background: 'none', border: 'none', color: '#5090ff', fontSize: '11px', fontWeight: 700, 
          textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 150ms'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,95,223,0.12)'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <CheckCheck size={14} /> Mark all read
        </button>
      </div>

      <div style={card}>
        {notifications.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Bell size={40} style={{ color: '#2a2a3a', margin: '0 auto 14px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#c0c0d0', marginBottom: '6px' }}>No notifications</h3>
            <p style={{ fontSize: '12px', color: '#3a3a50' }}>You're all caught up!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map(n => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 20px',
                borderBottom: '1px solid #151520', transition: 'background 150ms',
                background: !n.is_read ? 'rgba(45,95,223,0.05)' : 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.background = !n.is_read ? 'rgba(45,95,223,0.08)' : '#0f0f18'}
              onMouseLeave={e => e.currentTarget.style.background = !n.is_read ? 'rgba(45,95,223,0.05)' : 'transparent'}>
                
                {/* Unread indicator */}
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
                  background: !n.is_read ? '#2d5fdf' : 'transparent',
                }} />
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: !n.is_read ? 600 : 500, color: !n.is_read ? '#e0e0ec' : '#d0d0e0', marginBottom: '4px' }}>{n.title}</p>
                  {n.message && <p style={{ fontSize: '12px', color: '#6a6a80', marginBottom: '6px', lineHeight: 1.4 }}>{n.message}</p>}
                  <p style={{ fontSize: '10px', color: '#4a4a60' }}>{new Date(n.created_at).toLocaleString()}</p>
                </div>

                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} style={{
                    padding: '6px', borderRadius: '6px', background: 'none', border: 'none',
                    color: '#4a4a60', cursor: 'pointer', transition: 'all 150ms'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#5090ff'; e.currentTarget.style.background = 'rgba(45,95,223,0.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#4a4a60'; e.currentTarget.style.background = 'none'; }}>
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
