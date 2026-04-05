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
  const [searchFocused, setSearchFocused] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    api.get('/notifications', { params: { unread_only: true, limit: 1 } })
      .then(r => setUnreadCount(r.data.length)).catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <header style={{
      height: '54px', minHeight: '54px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      background: 'rgba(21, 15, 12, 0.65)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px',
    }}>
      {/* Search */}
      <div style={{ position: 'relative', width: '300px' }}>
        <Search size={13} style={{
          position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
          color: searchFocused ? 'rgba(249,115,22,0.6)' : 'rgba(88,66,55,0.6)',
          transition: 'color 150ms',
        }} />
        <input
          type="text"
          placeholder="Search projects, tasks, people..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            background: searchFocused ? '#241e1c' : '#1a1210',
            border: 'none',
            outline: `2px solid ${searchFocused ? 'rgba(249,115,22,0.35)' : 'transparent'}`,
            borderRadius: '9px',
            fontSize: '12px',
            color: '#e0c0b1',
            fontFamily: 'inherit',
            transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* Role Switcher */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 12px', borderRadius: '8px',
          background: 'rgba(249,115,22,0.08)',
          border: '1px solid rgba(249,115,22,0.2)',
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
          color: 'rgba(249,115,22,0.7)', cursor: 'pointer',
          textTransform: 'uppercase', transition: 'all 150ms',
        }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(249,115,22,0.15)';
            e.currentTarget.style.color = '#f97316';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(249,115,22,0.08)';
            e.currentTarget.style.color = 'rgba(249,115,22,0.7)';
          }}
        >
          <Repeat size={11} />
          Role Switcher
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          style={{
            position: 'relative', padding: '8px', borderRadius: '8px',
            background: 'none', border: 'none',
            color: 'rgba(88,66,55,0.7)', cursor: 'pointer',
            transition: 'all 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(88,66,55,0.15)'; e.currentTarget.style.color = '#e0c0b1'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(88,66,55,0.7)'; }}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '5px', right: '5px',
              width: '7px', height: '7px',
              background: '#f97316',
              borderRadius: '50%',
              boxShadow: '0 0 6px rgba(249,115,22,0.6)',
            }} />
          )}
        </button>

        {/* Settings */}
        <button style={{
          padding: '8px', borderRadius: '8px',
          background: 'none', border: 'none',
          color: 'rgba(88,66,55,0.7)', cursor: 'pointer',
          transition: 'all 150ms',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(88,66,55,0.15)'; e.currentTarget.style.color = '#e0c0b1'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(88,66,55,0.7)'; }}
        >
          <Settings size={16} />
        </button>

        {/* Profile Avatar */}
        <div ref={profileRef} style={{ position: 'relative', marginLeft: '6px' }}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            style={{
              width: '33px', height: '33px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #743814, #f97316)',
              border: '2px solid rgba(249,115,22,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 800, color: '#341100',
              cursor: 'pointer', transition: 'all 150ms',
              boxShadow: showProfile ? '0 0 12px rgba(249,115,22,0.4)' : 'none',
            }}
          >
            {initials}
          </button>

          {showProfile && (
            <div style={{
              position: 'absolute', right: 0, top: '44px',
              width: '220px',
              background: '#241e1c',
              border: '1px solid rgba(88,66,55,0.3)',
              borderRadius: '12px',
              overflow: 'hidden', zIndex: 100,
              boxShadow: '0 20px 40px rgba(15,10,8,0.7)',
              animation: 'fadeIn 0.15s ease-out',
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(88,66,55,0.2)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ece0dc' }}>
                  {user?.full_name}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(167,139,125,0.6)', marginTop: '2px' }}>
                  {user?.email}
                </div>
              </div>
              <button style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '10px 16px',
                background: 'none', border: 'none',
                fontSize: '13px', color: '#e0c0b1',
                cursor: 'pointer', textAlign: 'left', transition: 'background 150ms',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(88,66,55,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <User size={14} /> Profile
              </button>
              <div style={{ borderTop: '1px solid rgba(88,66,55,0.2)' }} />
              <button
                onClick={() => { setShowProfile(false); logout(); navigate('/login'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 16px',
                  background: 'none', border: 'none',
                  fontSize: '13px', color: 'rgba(248,113,113,0.8)',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 150ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
