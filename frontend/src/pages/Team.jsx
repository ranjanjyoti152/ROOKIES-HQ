import { useState, useEffect } from 'react';
import api from '../api/client';
import { Plus, Radio, UserX, UserCheck, Crown, X } from 'lucide-react';
import useAuthStore from '../store/authStore';

const card = { background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px' };
const label = { display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(167,139,125,0.5)', textTransform: 'uppercase', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '12px 16px', background: '#2f2926', border: '1px solid rgba(88,66,55,0.3)', borderRadius: '8px', fontSize: '14px', color: '#e0c0b1', outline: 'none', boxSizing: 'border-box' };
const th = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(88,66,55,0.5)', textTransform: 'uppercase', padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid rgba(88,66,55,0.15)' };
const td = { padding: '12px 16px', borderBottom: '1px solid #111118', fontSize: '13px' };

const ROLES = ['admin','manager','editor','client','hr','marketing'];

export default function Team() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'editor' });

  const fetchUsers = async () => { try { const r = await api.get('/users'); setUsers(r.data); } catch {} };
  useEffect(() => { fetchUsers(); }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users/invite', form);
      setShowInvite(false);
      setForm({ email: '', full_name: '', password: '', role: 'editor' });
      fetchUsers();
    } catch (e) { alert(e.response?.data?.detail || 'Failed to invite user'); }
  };

  const handleRole = async (id, role) => {
    try { await api.put(`/users/${id}/role`, { role }); fetchUsers(); }
    catch (e) { alert(e.response?.data?.detail || 'Failed to update role'); }
  };

  const toggleActive = async (id, activate) => {
    try { await api.post(`/users/${id}/${activate ? 'activate' : 'deactivate'}`); fetchUsers(); }
    catch (e) { alert(e.response?.data?.detail || 'Failed'); }
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Team</h1>
        <button onClick={() => setShowInvite(true)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px',
          background: '#f97316', border: 'none', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={15} /> Invite User
        </button>
      </div>

      {/* Table */}
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>User</th>
              <th style={th}>Role</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ transition: 'background 150ms' }}
                onMouseEnter={e => e.currentTarget.style.background = '#0f0f18'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', background: '#2f2926',
                      border: '1px solid rgba(88,66,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, color: 'rgba(167,139,125,0.5)'
                    }}>
                      {u.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ece0dc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {u.full_name}
                        {u.is_owner && <Crown size={12} style={{ color: '#eab308' }} />}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(88,66,55,0.6)', marginTop: '2px' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={td}>
                  <select value={u.role} onChange={e => handleRole(u.id, e.target.value)} disabled={u.is_owner}
                    style={{
                      background: 'transparent', color: 'rgba(167,139,125,0.6)', border: 'none', outline: 'none',
                      fontSize: '12px', fontWeight: 600, cursor: u.is_owner ? 'default' : 'pointer',
                      opacity: u.is_owner ? 0.5 : 1
                    }}>
                    {ROLES.map(r => <option key={r} value={r} style={{ background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>{r}</option>)}
                  </select>
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {u.is_checked_in && <Radio size={12} style={{ color: '#22c55e', animation: 'pulse 2s infinite' }} />}
                    <span style={{
                      padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: u.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color: u.is_active ? '#22c55e' : '#ef4444',
                    }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {!u.is_owner && u.id !== currentUser?.id && (
                    <button onClick={() => toggleActive(u.id, !u.is_active)} style={{
                      padding: '6px', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer',
                      color: u.is_active ? '#ef4444' : '#22c55e', transition: 'all 150ms'
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = u.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setShowInvite(false)}>
          <div style={{ ...card, padding: '32px', width: '100%', maxWidth: '420px', animation: 'scaleIn 0.15s ease-out' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ece0dc' }}>Invite User</h2>
              <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', color: 'rgba(88,66,55,0.6)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Full Name</label>
                <input type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required placeholder="John Doe"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = '#f97316'} onBlur={e => e.target.style.borderColor = 'rgba(88,66,55,0.3)'} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="john@example.com"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = '#f97316'} onBlur={e => e.target.style.borderColor = 'rgba(88,66,55,0.3)'} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={label}>Password</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required placeholder="Temporary password"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = '#f97316'} onBlur={e => e.target.style.borderColor = 'rgba(88,66,55,0.3)'} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={label}>Role</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowInvite(false)} style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: 'transparent',
                  border: '1px solid rgba(88,66,55,0.3)', fontSize: '14px', fontWeight: 600, color: 'rgba(167,139,125,0.6)', cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: '#f97316',
                  border: 'none', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer',
                }}>Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%, 100% { opacity: 1; text-shadow: 0 0 8px rgba(34,197,94,0.5); } 50% { opacity: 0.5; text-shadow: none; } }
      `}</style>
    </div>
  );
}
