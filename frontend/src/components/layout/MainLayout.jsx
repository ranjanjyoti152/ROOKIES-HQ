import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function MainLayout() {
  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: 'radial-gradient(1200px 600px at 12% -20%, rgba(249,115,22,0.14), transparent), radial-gradient(900px 520px at 100% -10%, rgba(168,85,247,0.08), transparent), #120d0b',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent 16%), radial-gradient(circle at 20% 80%, rgba(249,115,22,0.06), transparent 32%)',
      }} />
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <TopBar />
        <main style={{
          flex: 1, overflow: 'auto',
          padding: '28px 32px',
          background: 'linear-gradient(180deg, rgba(24,18,16,0.84), rgba(24,18,16,0.96))',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
