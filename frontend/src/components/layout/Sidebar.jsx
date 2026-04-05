import { NavLink, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import {
  LayoutDashboard, Swords, Kanban, FolderOpen, Target, Zap, Users, Trophy,
  ClipboardList, Clock, Briefcase, Palette, StickyNote, Bell, ChevronLeft,
  ChevronRight, LogOut, Bolt,
} from 'lucide-react';

const iconMap = {
  LayoutDashboard, Swords, Kanban, FolderOpen, Target, Zap, Users, Trophy,
  ClipboardList, Clock, Briefcase, Palette, StickyNote, Bell,
};

function groupItems(items) {
  const sections = { MAIN: [], PERFORMANCE: [], TOOLS: [] };
  const perf = ['leaderboard', 'my_work', 'time_report'];
  const tools = ['canvas', 'notes', 'work_dashboard'];
  for (const item of items) {
    if (perf.includes(item.key)) sections.PERFORMANCE.push(item);
    else if (tools.includes(item.key)) sections.TOOLS.push(item);
    else sections.MAIN.push(item);
  }
  return sections;
}

export default function Sidebar() {
  const { sidebarItems, user, organization, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();
  const sections = groupItems(sidebarItems);
  const w = sidebarCollapsed ? 56 : 200;

  const labelStyle = {
    fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: '#3a3a50',
    textTransform: 'uppercase', padding: '18px 16px 6px 16px',
  };

  const NavItem = ({ item }) => {
    const Icon = iconMap[item.icon] || LayoutDashboard;
    const active = location.pathname === item.path;
    return (
      <NavLink to={item.path} style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: sidebarCollapsed ? '8px 0' : '8px 16px',
        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
        fontSize: '13px', fontWeight: 500, textDecoration: 'none',
        color: active ? '#5090ff' : '#6a6a80',
        background: active ? 'rgba(45,95,223,0.08)' : 'transparent',
        borderLeft: active ? '3px solid #2d5fdf' : '3px solid transparent',
        transition: 'all 120ms',
        position: 'relative',
      }}>
        <Icon size={16} style={{ flexShrink: 0 }} />
        {!sidebarCollapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
      </NavLink>
    );
  };

  return (
    <aside style={{
      width: w, minWidth: w, height: '100%', display: 'flex', flexDirection: 'column',
      background: '#0c0c12', borderRight: '1px solid #151520', transition: 'width 200ms',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: sidebarCollapsed ? '16px 0' : '16px 16px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', borderBottom: '1px solid #151520', minHeight: '54px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#2d5fdf', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bolt size={14} style={{ color: 'white' }} />
        </div>
        {!sidebarCollapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#d0d0e0', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
              {organization?.name || 'Rookies HQ'}
            </div>
            <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.15em', color: '#3a3a50', textTransform: 'uppercase' }}>
              Creative Studio
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingTop: '8px' }}>
        {sections.MAIN.map(item => <NavItem key={item.key} item={item} />)}

        {sections.PERFORMANCE.length > 0 && (
          <>
            {!sidebarCollapsed && <div style={labelStyle}>Performance</div>}
            {sidebarCollapsed && <div style={{ borderTop: '1px solid #151520', margin: '8px 12px' }} />}
            {sections.PERFORMANCE.map(item => <NavItem key={item.key} item={item} />)}
          </>
        )}

        {sections.TOOLS.length > 0 && (
          <>
            {!sidebarCollapsed && <div style={labelStyle}>Tools</div>}
            {sidebarCollapsed && <div style={{ borderTop: '1px solid #151520', margin: '8px 12px' }} />}
            {sections.TOOLS.map(item => <NavItem key={item.key} item={item} />)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #151520', padding: '12px' }}>
        {!sidebarCollapsed && (
          <div style={{ padding: '0 4px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', color: '#3a3a50', textTransform: 'uppercase' }}>Daily Goal</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#2d5fdf' }}>80%</span>
            </div>
            <div style={{ width: '100%', height: '3px', background: '#151520', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: '80%', height: '100%', background: '#2d5fdf', borderRadius: '2px' }} />
            </div>
          </div>
        )}
        <button onClick={logout} style={{
          display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
          padding: '8px', borderRadius: '6px', background: 'none', border: 'none',
          fontSize: '12px', color: '#3a3a50', cursor: 'pointer',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
        }}>
          <LogOut size={14} />
          {!sidebarCollapsed && <span>Logout</span>}
        </button>
        <button onClick={toggleSidebar} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
          padding: '6px', borderRadius: '6px', background: 'none', border: 'none',
          color: '#3a3a50', cursor: 'pointer', marginTop: '4px',
        }}>
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
