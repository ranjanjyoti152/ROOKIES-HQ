import { useState, useEffect } from 'react';
import api from '../api/client';
import { Zap, Plus, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react';

const card = { background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px' };
const label = { display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(167,139,125,0.5)', textTransform: 'uppercase', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '12px 16px', background: '#2f2926', border: '1px solid rgba(88,66,55,0.3)', borderRadius: '8px', fontSize: '14px', color: '#e0c0b1', outline: 'none', boxSizing: 'border-box' };

export default function Automations() {
  const [rules, setRules] = useState([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', trigger_type: 'task_status_change', action_type: 'send_notification' });

  const fetch = () => api.get('/automations')
    .then((r) => {
      setRules(r.data);
      setError('');
    })
    .catch((err) => {
      setError(err.response?.data?.detail || 'Unable to load automation rules.');
    });
  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/automations', form);
      setShowCreate(false);
      setForm({ name: '', trigger_type: 'task_status_change', action_type: 'send_notification' });
      fetch();
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create automation rule.');
    }
  };
  const toggle = async (id) => {
    try {
      await api.post(`/automations/${id}/toggle`);
      fetch();
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update automation state.');
    }
  };
  const del = async (id) => {
    try {
      await api.delete(`/automations/${id}`);
      setRules(p => p.filter(r => r.id !== id));
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete automation rule.');
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {error && (
        <div style={{ ...card, padding: '12px 14px', marginBottom: '12px', fontSize: '12px', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Automations</h1>
          <p style={{ fontSize: '13px', color: 'rgba(88,66,55,0.6)', marginTop: '4px' }}>Configure triggers and actions for your workflow</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px',
          background: '#f97316', border: 'none', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={15} /> New Rule
        </button>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div style={{ ...card, padding: '60px 20px', textAlign: 'center' }}>
          <Zap size={40} style={{ color: 'rgba(88,66,55,0.5)', margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#e0c0b1', marginBottom: '6px' }}>No automation rules yet</h3>
          <p style={{ fontSize: '12px', color: 'rgba(88,66,55,0.5)' }}>Create your first rule to automate repetitive tasks</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rules.map(r => (
            <div key={r.id} style={{ ...card, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border 150ms' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(88,66,55,0.5)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(88,66,55,0.2)'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: r.is_active ? 'rgba(234,179,8,0.1)' : '#241e1c',
                  border: `1px solid ${r.is_active ? 'rgba(234,179,8,0.2)' : 'rgba(88,66,55,0.15)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Zap size={16} style={{ color: r.is_active ? '#eab308' : 'rgba(88,66,55,0.5)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#ece0dc' }}>{r.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                      background: 'rgba(249,115,22,0.12)', color: '#ffb690', textTransform: 'uppercase',
                    }}>{r.trigger_type.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(88,66,55,0.5)' }}>→</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                      background: 'rgba(34,197,94,0.12)', color: '#22c55e', textTransform: 'uppercase',
                    }}>{r.action_type.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={() => toggle(r.id)} style={{
                  padding: '6px 8px', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer',
                  transition: 'background 150ms',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#241e1c'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  {r.is_active
                    ? <ToggleRight size={22} style={{ color: '#22c55e' }} />
                    : <ToggleLeft size={22} style={{ color: 'rgba(88,66,55,0.5)' }} />
                  }
                </button>
                <button onClick={() => del(r.id)} style={{
                  padding: '6px 8px', borderRadius: '6px', background: 'none', border: 'none',
                  color: 'rgba(88,66,55,0.5)', cursor: 'pointer', transition: 'all 150ms',
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(88,66,55,0.5)'; e.currentTarget.style.background = 'none'; }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setShowCreate(false)}>
          <div style={{ ...card, padding: '32px', width: '100%', maxWidth: '420px', animation: 'scaleIn 0.15s ease-out' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ece0dc' }}>New Automation Rule</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'rgba(88,66,55,0.6)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '20px' }}>
                <label style={label}>Rule Name</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="e.g. Notify on Review"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = '#f97316'} onBlur={e => e.target.style.borderColor = 'rgba(88,66,55,0.3)'} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={label}>Trigger</label>
                <select value={form.trigger_type} onChange={e => setForm({...form, trigger_type: e.target.value})}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="task_status_change">Task Status Change</option>
                  <option value="lead_conversion">Lead Conversion</option>
                  <option value="comment_added">Comment Added</option>
                </select>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={label}>Action</label>
                <select value={form.action_type} onChange={e => setForm({...form, action_type: e.target.value})}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="send_notification">Send Notification</option>
                  <option value="move_task">Move Task</option>
                  <option value="assign_user">Assign User</option>
                  <option value="add_points">Add Points</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: 'transparent',
                  border: '1px solid rgba(88,66,55,0.3)', fontSize: '14px', fontWeight: 600, color: 'rgba(167,139,125,0.6)', cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: '#f97316',
                  border: 'none', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer',
                }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
