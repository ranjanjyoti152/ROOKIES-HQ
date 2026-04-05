import { Briefcase } from 'lucide-react';

const card = { background: '#0d0d14', border: '1px solid #1a1a28', borderRadius: '10px' };

export default function WorkDashboard() {
  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out', maxWidth: '800px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e0e0ec' }}>Work Dashboard</h1>
        <p style={{ fontSize: '13px', color: '#4a4a60', marginTop: '4px' }}>A high-level view of active client work and projects</p>
      </div>

      <div style={{ ...card, padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(45,95,223,0.05)', border: '1px solid rgba(45,95,223,0.1)', marginBottom: '20px' }}>
          <Briefcase size={32} style={{ color: '#2d5fdf' }} />
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#c0c0d0', marginBottom: '8px' }}>Client Work Dashboard</h3>
        <p style={{ fontSize: '13px', color: '#5a5a70', maxWidth: '300px', margin: '0 auto', lineHeight: 1.5 }}>
          This section is currently under construction. Check back soon for the full client overview experience.
        </p>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
