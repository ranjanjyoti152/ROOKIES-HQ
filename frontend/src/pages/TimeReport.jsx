import { useState, useEffect } from 'react';
import api from '../api/client';
import { Clock } from 'lucide-react';

const card = { background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px', padding: '24px' };

export default function TimeReport() {
  const [report, setReport] = useState({ entries: [], total_seconds: 0 });
  const [days, setDays] = useState(7);

  useEffect(() => { api.get('/time-entries/report', { params: { days } }).then(r => setReport(r.data)).catch(() => {}); }, [days]);
  const fmt = (s) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h}h ${m}m`; };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out', maxWidth: '640px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Time Report</h1>
          <p style={{ fontSize: '13px', color: 'rgba(88,66,55,0.6)', marginTop: '4px' }}>Overview of team hours tracked</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="ui-select ui-select-sm" style={{ width: '165px' }}>
          <option value={1}>Today</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid rgba(88,66,55,0.15)' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={16} style={{ color: '#f97316' }} />
          </div>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(167,139,125,0.5)', textTransform: 'uppercase' }}>Total Logged</span>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#ece0dc', marginTop: '2px' }}>{fmt(report.total_seconds)}</div>
          </div>
        </div>

        {report.entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: '13px', color: 'rgba(88,66,55,0.6)' }}>No time entries for this period</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {report.entries.map(e => (
              <div key={e.user_id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px',
                borderRadius: '8px', background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', background: '#2f2926',
                    border: '1px solid rgba(88,66,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color: 'rgba(167,139,125,0.5)'
                  }}>
                    {e.user_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#ece0dc' }}>{e.user_name}</p>
                    <p style={{ fontSize: '12px', color: 'rgba(88,66,55,0.6)', marginTop: '2px' }}>{e.task_count} tasks tracked</p>
                  </div>
                </div>

                <div style={{ textAlign: 'right', width: '120px' }}>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: '#f97316' }}>{fmt(e.total_seconds)}</p>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(88,66,55,0.15)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
                    <div style={{
                      height: '100%', background: '#f97316', borderRadius: '2px',
                      width: `${Math.min(100, (e.total_seconds / report.total_seconds) * 100)}%`
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
