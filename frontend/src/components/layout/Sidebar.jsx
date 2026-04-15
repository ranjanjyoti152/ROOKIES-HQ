import { NavLink, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import {
  LayoutDashboard, Swords, Kanban, FolderOpen, Target, Zap, Users, Trophy,
  ClipboardList, Clock, Briefcase, Palette, StickyNote, Bell, ChevronLeft,
  ChevronRight, LogOut, Flame, Bot, SlidersHorizontal, Building2,
} from 'lucide-react';

const iconMap = {
  LayoutDashboard, Swords, Kanban, FolderOpen, Target, Zap, Users, Trophy,
  ClipboardList, Clock, Briefcase, Palette, StickyNote, Bell, Bot, SlidersHorizontal, Building2,
};

function groupItems(items) {
  const sections = { GENERAL: [], PERFORMANCE: [], TOOLS: [] };
  const perf = ['leaderboard', 'my_work', 'time_report'];
  const tools = ['canvas', 'notes', 'work_dashboard', 'client_portal', 'ai_assistant', 'settings'];
  for (const item of items) {
    if (perf.includes(item.key)) sections.PERFORMANCE.push(item);
    else if (tools.includes(item.key)) sections.TOOLS.push(item);
    else sections.GENERAL.push(item);
  }
  return sections;
}

function SectionLabel({ children, sidebarCollapsed }) {
  if (sidebarCollapsed) {
    return <div style={{ borderTop: '1px solid rgba(88,66,55,0.2)', margin: '10px 14px' }} />;
  }

  return (
    <div style={{
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '0.14em',
      color: 'rgba(88,66,55,0.6)',
      textTransform: 'uppercase',
      padding: '20px 18px 6px 18px',
    }}>
      {children}
    </div>
  );
}

function NavItem({ item, sidebarCollapsed, pathname }) {
  const Icon = iconMap[item.icon] || LayoutDashboard;
  const active = pathname === item.path;

  return (
    <NavLink
      to={item.path}
      style={{
        display: 'flex', alignItems: 'center',
        gap: sidebarCollapsed ? 0 : '10px',
        padding: sidebarCollapsed ? '9px 0' : '8px 16px 8px 18px',
        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
        fontSize: '13px', fontWeight: active ? 600 : 500,
        textDecoration: 'none', position: 'relative',
        color: active ? '#ffb690' : 'rgba(167,139,125,0.7)',
        background: active ? 'rgba(249,115,22,0.08)' : 'transparent',
        transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
        marginBottom: '2px',
      }}
    >
      {/* Left orange border for active */}
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: '4px', bottom: '4px',
          width: '3px', background: 'linear-gradient(180deg, #ffb690, #f97316)',
          borderRadius: '0 3px 3px 0',
        }} />
      )}
      <Icon
        size={15}
        style={{
          flexShrink: 0,
          color: active ? '#f97316' : 'rgba(167,139,125,0.5)',
          filter: active ? 'drop-shadow(0 0 4px rgba(249,115,22,0.4))' : 'none',
          transition: 'color 150ms',
        }}
      />
      {!sidebarCollapsed && (
        <span style={{
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: 'color 150ms',
        }}>
          {item.label}
        </span>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const { sidebarItems, organization, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();
  const sections = groupItems(sidebarItems);
  const w = sidebarCollapsed ? 58 : 210;

  return (
    <aside style={{
      width: w, minWidth: w, height: '100%', display: 'flex', flexDirection: 'column',
      background: 'rgba(21, 15, 12, 0.55)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      transition: 'width 200ms cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* ── Logo ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: sidebarCollapsed ? 0 : '10px',
        padding: sidebarCollapsed ? '16px 0' : '15px 16px 15px 18px',
        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
        borderBottom: '1px solid rgba(88,66,55,0.18)',
        minHeight: 56,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '9px',
          background: 'linear-gradient(135deg, #ffb690, #f97316)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 12px rgba(249,115,22,0.4)',
        }}>
          <Flame size={15} color="#341100" strokeWidth={2.5} />
        </div>
        {!sidebarCollapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: '13px', fontWeight: 800,
              color: '#f5ede8', lineHeight: 1.2, whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
            }}>
              {organization?.name || 'Rookies HQ'}
            </div>
            <div style={{
              fontSize: '9px', fontWeight: 600, letterSpacing: '0.15em',
              color: 'rgba(249,115,22,0.5)', textTransform: 'uppercase',
            }}>
              Team's workspace
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingTop: '6px', paddingBottom: '4px' }}>
        {sections.GENERAL.length > 0 && (
          <>
            <SectionLabel sidebarCollapsed={sidebarCollapsed}>General</SectionLabel>
            {sections.GENERAL.map(item => <NavItem key={item.key} item={item} sidebarCollapsed={sidebarCollapsed} pathname={location.pathname} />)}
          </>
        )}
        {sections.PERFORMANCE.length > 0 && (
          <>
            <SectionLabel sidebarCollapsed={sidebarCollapsed}>Performance</SectionLabel>
            {sections.PERFORMANCE.map(item => <NavItem key={item.key} item={item} sidebarCollapsed={sidebarCollapsed} pathname={location.pathname} />)}
          </>
        )}
        {sections.TOOLS.length > 0 && (
          <>
            <SectionLabel sidebarCollapsed={sidebarCollapsed}>Tools</SectionLabel>
            {sections.TOOLS.map(item => <NavItem key={item.key} item={item} sidebarCollapsed={sidebarCollapsed} pathname={location.pathname} />)}
          </>
        )}
      </nav>

      {/* ── Footer ── */}
      <div style={{ borderTop: '1px solid rgba(88,66,55,0.18)', padding: '12px' }}>
        {/* Daily Goal */}
        {!sidebarCollapsed && (
          <div style={{ padding: '0 4px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(88,66,55,0.6)', textTransform: 'uppercase' }}>
                Daily Goal
              </span>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#f97316' }}>80%</span>
            </div>
            <div style={{ width: '100%', height: '5px', background: 'rgba(88,66,55,0.3)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{
                width: '80%', height: '100%',
                background: 'linear-gradient(90deg, #ffb690, #f97316)',
                borderRadius: '9999px',
                boxShadow: '0 0 6px rgba(249,115,22,0.4)',
              }} />
            </div>
          </div>
        )}


        {/* Logout */}
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center',
            gap: sidebarCollapsed ? 0 : '10px',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            width: '100%', padding: '8px', borderRadius: '8px',
            background: 'none', border: 'none',
            fontSize: '12px', color: 'rgba(167,139,125,0.45)',
            cursor: 'pointer', transition: 'all 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(88,66,55,0.2)'; e.currentTarget.style.color = 'rgba(240,100,70,0.7)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(167,139,125,0.45)'; }}
        >
          <LogOut size={13} />
          {!sidebarCollapsed && <span>Logout</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', padding: '6px', borderRadius: '8px',
            background: 'none', border: 'none',
            color: 'rgba(88,66,55,0.5)', cursor: 'pointer',
            transition: 'all 150ms', marginTop: '2px',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(249,115,22,0.6)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(88,66,55,0.5)'}
        >
          {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>
    </aside>
  );
}
