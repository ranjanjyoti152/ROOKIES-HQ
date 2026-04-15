import { useMemo, useState, useEffect } from 'react';
import api from '../api/client';
import { Plus, Radio, UserX, UserCheck, Crown, X, Search, Star, MoreVertical, KeyRound } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useToastStore from '../store/toastStore';

const card = {
  background: 'rgba(32, 26, 24, 0.55)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(88,66,55,0.2)',
  borderRadius: '10px',
};
const label = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  color: 'rgba(167,139,125,0.5)',
  textTransform: 'uppercase',
  marginBottom: '8px',
};
const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  background: '#2f2926',
  border: '1px solid rgba(88,66,55,0.3)',
  borderRadius: '8px',
  fontSize: '14px',
  color: '#e0c0b1',
  outline: 'none',
  boxSizing: 'border-box',
};

const ROLES = ['admin', 'manager', 'editor', 'client', 'hr', 'marketing'];

const POINT_SYSTEM = [
  { label: '+15 Closed Sale', points: 15, category: 'closed_sale', positive: true },
  { label: '+12 Successful VFA', points: 12, category: 'successful_vfa', positive: true },
  { label: '-3 Failed VFA', points: -3, category: 'failed_vfa', positive: false },
  { label: '+15 Client Video', points: 15, category: 'client_video', positive: true },
  { label: '-0.5 Revision', points: -0.5, category: 'revision', positive: false },
  { label: '+5 Instagram Launch', points: 5, category: 'instagram_launch', positive: true },
  { label: '+10 5k Followers', points: 10, category: 'five_k_followers', positive: true },
  { label: '+20 10k Followers', points: 20, category: 'ten_k_followers', positive: true },
  { label: '+20 Pro Rank', points: 20, category: 'pro_rank', positive: true },
];

export default function Team() {
  const { user: currentUser } = useAuthStore();
  const { pushToast } = useToastStore();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', nickname: '', password: '', role: 'editor' });

  const fetchUsers = async () => {
    try {
      const r = await api.get('/users');
      setUsers(r.data || []);
      setError('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to load team members.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await api.get('/users');
        if (!cancelled) {
          setUsers(r.data || []);
          setError('');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.detail || 'Unable to load team members.');
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.full_name, u.nickname, u.email, u.role, ...(u.role_tags || [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)));
  }, [users, search]);

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      const inviteRes = await api.post('/users/invite', {
        email: form.email,
        full_name: form.full_name,
        password: form.password,
        role: form.role,
      });

      if (form.nickname.trim()) {
        await api.put(`/users/${inviteRes.data.id}`, { nickname: form.nickname.trim() });
      }

      setShowInvite(false);
      setForm({ email: '', full_name: '', nickname: '', password: '', role: 'editor' });
      await fetchUsers();
      pushToast({ type: 'success', title: 'Member invited', message: `${inviteRes.data.full_name} has been added.` });
    } catch (e) {
      const message = e.response?.data?.detail || 'Failed to invite member';
      setError(message);
      pushToast({ type: 'error', title: 'Invite failed', message });
    }
  };

  const handleRole = async (id, role) => {
    try {
      await api.put(`/users/${id}/role`, { role });
      await fetchUsers();
      pushToast({ type: 'success', title: 'Role updated', message: `Role changed to ${role}.` });
    } catch (e) {
      const message = e.response?.data?.detail || 'Failed to update role';
      setError(message);
      pushToast({ type: 'error', title: 'Role update failed', message });
    }
  };

  const toggleActive = async (id, activate) => {
    try {
      await api.post(`/users/${id}/${activate ? 'activate' : 'deactivate'}`);
      await fetchUsers();
      pushToast({ type: 'success', title: activate ? 'Member activated' : 'Member deactivated', message: 'Status updated successfully.' });
    } catch (e) {
      const message = e.response?.data?.detail || 'Failed to update status';
      setError(message);
      pushToast({ type: 'error', title: 'Status update failed', message });
    }
  };

  const resetPassword = async (u) => {
    if (!(currentUser?.role === 'admin' || currentUser?.is_superadmin)) return;
    const nextPassword = window.prompt(`Set temporary password for ${u.full_name} (min 8 chars)`, '');
    if (nextPassword === null) return;
    if ((nextPassword || '').length < 8) {
      setError('Temporary password must be at least 8 characters.');
      return;
    }
    try {
      await api.post(`/users/${u.id}/password/reset`, {
        new_password: nextPassword,
        require_change: true,
      });
      await fetchUsers();
      pushToast({
        type: 'success',
        title: 'Password reset',
        message: `${u.full_name} must change password on next login.`,
      });
    } catch (e) {
      const message = e.response?.data?.detail || 'Failed to reset password';
      setError(message);
      pushToast({ type: 'error', title: 'Password reset failed', message });
    }
  };

  const updateNickname = async (u) => {
    const value = window.prompt('Set nickname', u.nickname || '');
    if (value === null) return;
    try {
      await api.put(`/users/${u.id}`, { nickname: value.trim() || null });
      await fetchUsers();
    } catch (e) {
      const message = e.response?.data?.detail || 'Failed to update nickname';
      setError(message);
      pushToast({ type: 'error', title: 'Nickname update failed', message });
    }
  };

  const addRoleTag = async (u) => {
    const value = window.prompt('Add custom role tag', 'research');
    if (!value) return;
    const next = Array.from(new Set([...(u.role_tags || []), value.trim().toLowerCase()]));
    try {
      await api.put(`/users/${u.id}`, { role_tags: next });
      await fetchUsers();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to add role tag.');
    }
  };

  const adjustPoints = async (u, preset) => {
    try {
      await api.post('/leaderboard/adjust', {
        user_id: u.id,
        points: preset.points,
        reason: preset.label,
        category: preset.category,
      });
      await fetchUsers();
      pushToast({ type: 'success', title: 'Points updated', message: `${preset.label} applied to ${u.nickname || u.full_name}.` });
    } catch (e) {
      const message = e.response?.data?.detail || 'Failed to adjust points';
      setError(message);
      pushToast({ type: 'error', title: 'Point adjustment failed', message });
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {error && <div style={{ ...card, padding: '12px 14px', marginBottom: '12px', fontSize: '12px', color: '#f87171' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Team</h1>
          <p style={{ marginTop: '4px', fontSize: '12px', color: 'rgba(167,139,125,0.64)' }}>{users.length} members</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(88,66,55,0.56)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members..." style={{ ...inputStyle, paddingLeft: '30px' }} />
          </div>

          <button onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px', background: '#f97316', border: 'none', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={15} /> Invite Member
          </button>
        </div>
      </div>

      <div style={{ ...card, marginBottom: '14px', padding: '14px' }}>
        <h2 style={{ fontSize: '13px', color: '#f4e2da', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, marginBottom: '10px' }}>⭐ Point System</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {POINT_SYSTEM.map((item) => (
            <span key={item.label} style={{ padding: '5px 9px', borderRadius: '14px', fontSize: '11px', fontWeight: 700, background: item.positive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: item.positive ? '#22c55e' : '#ef4444' }}>
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        {filteredUsers.map((u) => (
          <div key={u.id} style={{ ...card, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#2f2926', border: '1px solid rgba(88,66,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'rgba(167,139,125,0.6)' }}>
                  {u.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ece0dc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {u.full_name}
                    {u.nickname && <span style={{ fontSize: '11px', color: '#ffb690' }}>@{u.nickname}</span>}
                    {u.is_owner && <Crown size={12} style={{ color: '#eab308' }} />}
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(88,66,55,0.6)' }}>{u.email}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => updateNickname(u)} style={{ border: 'none', background: 'transparent', color: 'rgba(167,139,125,0.62)', cursor: 'pointer' }} title="Nickname">
                  <Star size={14} />
                </button>
                <button onClick={() => addRoleTag(u)} style={{ border: 'none', background: 'transparent', color: 'rgba(167,139,125,0.62)', cursor: 'pointer' }} title="Add role tag">
                  <MoreVertical size={14} />
                </button>
              </div>
            </div>

            <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <select value={u.role} onChange={(e) => handleRole(u.id, e.target.value)} disabled={u.is_owner} className="ui-select ui-select-sm" style={{ minWidth: '110px' }}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                {(u.role_tags || []).map((tag) => (
                  <span key={tag} style={{ padding: '3px 7px', borderRadius: '999px', fontSize: '10px', border: '1px solid rgba(88,66,55,0.3)', color: 'rgba(167,139,125,0.75)' }}>{tag}</span>
                ))}
              </div>

              <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: 700 }}>{Number(u.active_points || 0).toFixed(1)} active</div>
              <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 700 }}>-{Number(u.penalty_points || 0).toFixed(1)} pts</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {(currentUser?.role === 'admin' || currentUser?.is_superadmin) && (
                  <button
                    onClick={() => resetPassword(u)}
                    style={{ padding: '6px', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b' }}
                    title="Reset password"
                  >
                    <KeyRound size={15} />
                  </button>
                )}
                {!u.is_owner && u.id !== currentUser?.id && (
                  <button onClick={() => toggleActive(u.id, !u.is_active)} style={{ padding: '6px', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer', color: u.is_active ? '#ef4444' : '#22c55e' }}>
                    {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {u.is_checked_in && <Radio size={12} style={{ color: '#22c55e', animation: 'pulse 2s infinite' }} />}
                <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: u.is_active ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: u.is_active ? '#22c55e' : '#ef4444' }}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
                {u.must_change_password && (
                  <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(245,158,11,0.16)', color: '#f59e0b' }}>
                    Password Reset Pending
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {POINT_SYSTEM.slice(0, 5).map((preset) => (
                  <button
                    key={preset.label + u.id}
                    onClick={() => adjustPoints(u, preset)}
                    style={{
                      border: '1px solid rgba(88,66,55,0.28)',
                      background: 'transparent',
                      color: preset.positive ? '#22c55e' : '#ef4444',
                      borderRadius: '14px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {preset.points > 0 ? `+${preset.points}` : preset.points}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showInvite && (
        <div className="ui-overlay" style={{ zIndex: 100 }} onClick={() => setShowInvite(false)}>
          <div className="ui-subwindow" style={{ ...card, padding: '32px', width: '100%', maxWidth: '420px', animation: 'scaleIn 0.15s ease-out' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ece0dc' }}>Invite Member</h2>
              <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', color: 'rgba(88,66,55,0.6)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: '14px' }}>
                <label style={label}>Full Name</label>
                <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required placeholder="John Doe" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={label}>Nickname</label>
                <input type="text" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="Knox" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={label}>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="john@example.com" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={label}>Password</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="Temporary password" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={label}>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="ui-select">
                  {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowInvite(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(88,66,55,0.3)', fontSize: '14px', fontWeight: 600, color: 'rgba(167,139,125,0.6)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#f97316', border: 'none', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer' }}>Invite</button>
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
