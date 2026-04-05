import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { Bell, Search, Settings, LogOut, User, Repeat } from 'lucide-react';
import api from '../../api/client';

export default function TopBar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileRef = useRef(null);

  useEffect(() => {
    api.get('/notifications', { params: { unread_only: true, limit: 1 } }).then(r => setUnreadCount(r.data.length)).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <header style={{ height: '54px', minHeight: '54px', borderBottom: '1px solid #151520', background: '#0c0c12', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
      {/* Search */}
      <div style={{ position: 'relative', width: '280px' }}>
        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#3a3a50' }} />
        <input type="text" placeholder="Search tasks, assets, or projects..."
          style={{ width: '100%', padding: '8px 12px 8px 34px', background: '#101018', border: '1px solid #1a1a26', borderRadius: '8px', fontSize: '12px', color: '#8080a0', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', background: 'none', border: 'none', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#2d5fdf', cursor: 'pointer', textTransform: 'uppercase' }}>
          <Repeat size={13} /> Role Switcher
        </button>

        <button onClick={() => navigate('/notifications')} style={{ position: 'relative', padding: '8px', borderRadius: '6px', background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer' }}>
          <Bell size={17} />
          {unreadCount > 0 && <span style={{ position: 'absolute', top: '4px', right: '4px', width: '7px', height: '7px', background: '#ef4444', borderRadius: '50%' }} />}
        </button>

        <button style={{ padding: '8px', borderRadius: '6px', background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer' }}>
          <Settings size={17} />
        </button>

        <div ref={profileRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowProfile(!showProfile)}
            style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#131320', border: '1px solid #1c1c2c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#6a6a80', cursor: 'pointer' }}>
            {initials}
          </button>
          {showProfile && (
            <div style={{ position: 'absolute', right: 0, top: '42px', width: '200px', background: '#0d0d14', border: '1px solid #1a1a28', borderRadius: '10px', overflow: 'hidden', zIndex: 100 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a28' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#d0d0e0' }}>{user?.full_name}</div>
                <div style={{ fontSize: '11px', color: '#4a4a60', marginTop: '2px' }}>{user?.email}</div>
              </div>
              <button style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', background: 'none', border: 'none', fontSize: '13px', color: '#6a6a80', cursor: 'pointer', textAlign: 'left' }}>
                <User size={14} /> Profile
              </button>
              <div style={{ borderTop: '1px solid #1a1a28' }} />
              <button onClick={() => { setShowProfile(false); logout(); navigate('/login'); }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', background: 'none', border: 'none', fontSize: '13px', color: '#ef4444', cursor: 'pointer', textAlign: 'left' }}>
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
