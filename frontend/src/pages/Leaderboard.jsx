import { useState, useEffect } from 'react';
import api from '../api/client';
import { Trophy, Medal } from 'lucide-react';

const card = { background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px', overflow: 'hidden' };
const th = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(88,66,55,0.5)', textTransform: 'uppercase', padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid rgba(88,66,55,0.15)' };
const td = { padding: '12px 16px', borderBottom: '1px solid #111118', fontSize: '13px' };

const medalColors = { 1: '#eab308', 2: '#9ca3af', 3: '#d97706' };

export default function Leaderboard() {
  const [rankings, setRankings] = useState([]);
  const [period, setPeriod] = useState('weekly');

  useEffect(() => {
    api.get('/leaderboard', { params: { period } }).then(r => setRankings(r.data.rankings || [])).catch(() => {});
  }, [period]);

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Leaderboard</h1>
        <div style={{ display: 'flex', padding: '2px', borderRadius: '6px', background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)' }}>
          {['daily','weekly','monthly'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              background: period === p ? 'rgba(249,115,22,0.12)' : 'transparent',
              color: period === p ? '#ffb690' : 'rgba(88,66,55,0.6)', transition: 'all 150ms'
            }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div style={card}>
        {rankings.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Trophy size={40} style={{ color: 'rgba(88,66,55,0.5)', margin: '0 auto 14px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#e0c0b1', marginBottom: '6px' }}>No points earned this {period} period</h3>
            <p style={{ fontSize: '12px', color: 'rgba(88,66,55,0.5)' }}>Complete tasks to get on the board!</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: '64px', textAlign: 'center' }}>Rank</th>
                <th style={th}>User</th>
                <th style={th}>Activity</th>
                <th style={{ ...th, textAlign: 'right' }}>Points</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map(r => (
                <tr key={r.user_id} style={{ transition: 'background 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#0f0f18'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {r.rank <= 3 ? (
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <Medal size={18} style={{ color: medalColors[r.rank] }} />
                      </div>
                    ) : (
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(88,66,55,0.6)' }}>#{r.rank}</span>
                    )}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', background: '#2f2926',
                        border: '1px solid rgba(88,66,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, color: 'rgba(167,139,125,0.5)'
                      }}>
                        {r.full_name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) || '?'}
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#ece0dc' }}>{r.full_name}</p>
                        <p style={{ fontSize: '11px', color: 'rgba(88,66,55,0.6)', marginTop: '2px', textTransform: 'capitalize' }}>{r.role}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...td, color: '#a78b7d' }}>{r.entry_count} activities</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#f97316' }}>{r.total_points.toFixed(1)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
