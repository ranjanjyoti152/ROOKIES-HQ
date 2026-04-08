import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { Bell, Search, Settings, LogOut, User, Repeat, ArrowUpRight } from 'lucide-react';
import api from '../../api/client';
import useToastStore from '../../store/toastStore';

const ROUTE_SEARCH_INDEX = [
  { label: 'Dashboard', path: '/dashboard', keywords: 'overview home stats performance' },
  { label: 'Arena', path: '/arena', keywords: 'tasks claim editing active workspace' },
  { label: 'Pipeline', path: '/pipeline', keywords: 'kanban status drag drop' },
  { label: 'Projects', path: '/projects', keywords: 'clients projects campaigns' },
  { label: 'Leads', path: '/leads', keywords: 'sales leads pipeline crm' },
  { label: 'Automations', path: '/automations', keywords: 'rules workflow automation' },
  { label: 'Team', path: '/team', keywords: 'users members roles invite' },
  { label: 'Leaderboard', path: '/leaderboard', keywords: 'points ranking' },
  { label: 'My Work', path: '/my-work', keywords: 'my tasks assigned' },
  { label: 'Time Report', path: '/time-report', keywords: 'time hours report' },
  { label: 'Work Dashboard', path: '/work-dashboard', keywords: 'client delivery overview' },
  { label: 'Canvas', path: '/canvas', keywords: 'whiteboard canvas brainstorming' },
  { label: 'Notes', path: '/notes', keywords: 'markdown notes docs' },
  { label: 'AI Assistant', path: '/ai-assistant', keywords: 'assistant ai chat memory sse tools graphs' },
  { label: 'Settings', path: '/settings', keywords: 'ai providers api keys openai openrouter gemini ollama superadmin' },
  { label: 'Notifications', path: '/notifications', keywords: 'alerts inbox notifications' },
  { label: 'Workspaces', path: '/workspaces', keywords: 'organization workspace superadmin' },
];

export default function TopBar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pushToast } = useToastStore();

  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const profileRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const fetchUnreadCount = async () => {
      try {
        const response = await api.get('/notifications', { params: { unread_only: true, limit: 200 } });
        if (mounted) {
          setUnreadCount(response.data.length || 0);
        }
      } catch {
        if (mounted) {
          setUnreadCount(0);
        }
      }
    };

    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, 30000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const h = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  const searchResults = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return ROUTE_SEARCH_INDEX.slice(0, 6);

    return ROUTE_SEARCH_INDEX
      .filter((item) => (
        item.label.toLowerCase().includes(term) ||
        item.path.toLowerCase().includes(term) ||
        item.keywords.includes(term)
      ))
      .slice(0, 8);
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();

    const target = searchResults[0];
    if (!target) {
      pushToast({
        type: 'warning',
        title: 'No matches found',
        message: `No page found for "${searchQuery}".`,
      });
      return;
    }

    navigate(target.path);
    setSearchFocused(false);
    setSearchQuery('');
  };

  const handleSettingsClick = () => {
    if (user?.is_superadmin) {
      navigate('/settings');
      return;
    }

    pushToast({
      type: 'warning',
      title: 'Superadmin only',
      message: 'Settings can only be configured by a superadmin.',
    });
  };

  const handleRoleSwitcher = () => {
    navigate('/team');
    pushToast({
      type: 'info',
      title: 'Role management',
      message: 'Manage role assignments from the Team page.',
    });
  };

  const onSelectSearchResult = (path) => {
    navigate(path);
    setSearchFocused(false);
    setSearchQuery('');
  };

  return (
    <header style={{
      height: '58px',
      minHeight: '58px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(180deg, rgba(31,22,18,0.78), rgba(21,15,12,0.6))',
      backdropFilter: 'blur(18px) saturate(135%)',
      WebkitBackdropFilter: 'blur(18px) saturate(135%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 26px',
      position: 'relative',
      zIndex: 25,
    }}>
      <div ref={searchRef} style={{ position: 'relative', width: 'min(380px, 52vw)' }}>
        <form onSubmit={handleSearchSubmit}>
          <Search size={13} style={{
            position: 'absolute',
            left: '13px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: searchFocused ? 'rgba(249,115,22,0.88)' : 'rgba(88,66,55,0.7)',
            transition: 'color 180ms ease',
          }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages, projects, tasks..."
            onFocus={() => setSearchFocused(true)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              background: searchFocused ? 'rgba(47,41,38,0.82)' : 'rgba(26,18,16,0.92)',
              border: '1px solid',
              borderColor: searchFocused ? 'rgba(249,115,22,0.35)' : 'rgba(88,66,55,0.3)',
              outline: 'none',
              borderRadius: '11px',
              fontSize: '12px',
              color: '#f0e2dc',
              fontFamily: 'inherit',
              transition: 'all 180ms cubic-bezier(0.4,0,0.2,1)',
              boxShadow: searchFocused ? '0 0 0 3px rgba(249,115,22,0.12)' : 'none',
            }}
          />
        </form>

        {searchFocused && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            borderRadius: 12,
            border: '1px solid rgba(88,66,55,0.3)',
            background: 'rgba(24,18,16,0.97)',
            boxShadow: '0 24px 44px rgba(0,0,0,0.46)',
            overflow: 'hidden',
            animation: 'scaleIn 140ms ease-out',
            maxHeight: 300,
            overflowY: 'auto',
          }}>
            {searchResults.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: '12px', color: 'rgba(167,139,125,0.65)' }}>
                No results for "{searchQuery}"
              </div>
            ) : searchResults.map((item) => (
              <button
                key={item.path}
                onClick={() => onSelectSearchResult(item.path)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  borderBottom: '1px solid rgba(88,66,55,0.14)',
                  background: 'transparent',
                  color: '#eadbd4',
                  padding: '10px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span>{item.label}</span>
                <span style={{ fontSize: '11px', color: 'rgba(167,139,125,0.55)', fontWeight: 500 }}>{item.path}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={handleRoleSwitcher}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 12px', borderRadius: '9px',
            background: 'rgba(249,115,22,0.09)',
            border: '1px solid rgba(249,115,22,0.22)',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
            color: 'rgba(249,115,22,0.85)', cursor: 'pointer',
            textTransform: 'uppercase',
          }}
          title="Manage role behavior"
        >
          <Repeat size={11} />
          Role Switcher
        </button>

        <button
          onClick={() => navigate('/notifications')}
          style={{
            position: 'relative', padding: '8px', borderRadius: '8px',
            background: 'none', border: 'none',
            color: 'rgba(88,66,55,0.7)', cursor: 'pointer',
          }}
          title="Notifications"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '3px',
              right: '3px',
              minWidth: '16px',
              height: '16px',
              borderRadius: '999px',
              padding: '0 4px',
              display: 'grid',
              placeItems: 'center',
              fontSize: '9px',
              fontWeight: 800,
              color: '#1f120d',
              background: 'linear-gradient(135deg, #ffb690, #f97316)',
              boxShadow: '0 0 12px rgba(249,115,22,0.44)',
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={handleSettingsClick}
          style={{
            padding: '8px', borderRadius: '8px',
            background: 'none', border: 'none',
            color: 'rgba(88,66,55,0.7)', cursor: 'pointer',
          }}
          title="Settings"
        >
          <Settings size={16} />
        </button>

        <div ref={profileRef} style={{ position: 'relative', marginLeft: '6px' }}>
          <button
            onClick={() => setShowProfile((v) => !v)}
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #743814, #f97316)',
              border: '2px solid rgba(249,115,22,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 800, color: '#341100',
              cursor: 'pointer', boxShadow: showProfile ? '0 0 12px rgba(249,115,22,0.4)' : 'none',
            }}
            title="Profile menu"
          >
            {initials}
          </button>

          {showProfile && (
            <div style={{
              position: 'absolute', right: 0, top: '45px',
              width: '236px',
              background: '#241e1c',
              border: '1px solid rgba(88,66,55,0.3)',
              borderRadius: '12px',
              overflow: 'hidden', zIndex: 100,
              boxShadow: '0 22px 44px rgba(15,10,8,0.7)',
              animation: 'fadeIn 0.16s ease-out',
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(88,66,55,0.2)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ece0dc' }}>{user?.full_name}</div>
                <div style={{ fontSize: '11px', color: 'rgba(167,139,125,0.6)', marginTop: '2px' }}>{user?.email}</div>
              </div>

              <button
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 16px',
                  background: 'none', border: 'none',
                  fontSize: '13px', color: '#e0c0b1',
                  cursor: 'pointer', textAlign: 'left',
                }}
                onClick={() => {
                  setShowProfile(false);
                  navigate('/team');
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <User size={14} /> Profile & Team
                </span>
                <ArrowUpRight size={13} />
              </button>

              <div style={{ borderTop: '1px solid rgba(88,66,55,0.2)' }} />
              <button
                onClick={() => {
                  setShowProfile(false);
                  logout();
                  navigate('/login');
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 16px',
                  background: 'none', border: 'none',
                  fontSize: '13px', color: 'rgba(248,113,113,0.8)',
                  cursor: 'pointer', textAlign: 'left',
                }}
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
