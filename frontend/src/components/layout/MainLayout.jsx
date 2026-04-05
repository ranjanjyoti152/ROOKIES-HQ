import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function MainLayout() {
  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: '#0f0a08',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <main style={{
          flex: 1, overflow: 'auto',
          padding: '28px 32px',
          background: '#181210',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
