import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function MainLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#08080d', fontFamily: "'Inter', sans-serif" }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px', background: '#0a0a10' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
