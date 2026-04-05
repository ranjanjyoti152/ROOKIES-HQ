import { useState, useEffect } from 'react';
import api from '../api/client';
import { Plus, FolderOpen, Search, LayoutGrid, List, X } from 'lucide-react';

const card = { background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px' };
const label = { display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(167,139,125,0.5)', textTransform: 'uppercase', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '12px 16px', background: '#2f2926', border: '1px solid rgba(88,66,55,0.3)', borderRadius: '8px', fontSize: '14px', color: '#e0c0b1', outline: 'none', boxSizing: 'border-box' };

const statusBadge = {
  active: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  paused: { bg: 'rgba(234,179,8,0.12)', color: '#eab308' },
  completed: { bg: 'rgba(249,115,22,0.12)', color: '#ffb690' },
  archived: { bg: 'rgba(88,66,55,0.2)', color: 'rgba(88,66,55,0.6)' },
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', client_name: '', description: '', member_ids: [] });
  const [users, setUsers] = useState([]);

  const fetchProjects = async () => { try { const r = await api.get('/projects'); setProjects(r.data); } catch {} finally { setLoading(false); } };
  useEffect(() => { 
    fetchProjects(); 
    api.get('/users').then(res => setUsers(res.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { 
      if (form.id) {
        await api.put(`/projects/${form.id}`, form);
      } else {
        await api.post('/projects', form); 
      }
      setShowCreate(false); 
      setForm({ name: '', client_name: '', description: '', member_ids: [] }); 
      fetchProjects(); 
    } catch {}
  };

  const openEdit = (p) => {
    setForm({
      id: p.id,
      name: p.name,
      client_name: p.client_name || '',
      description: p.description || '',
      member_ids: p.assigned_members ? p.assigned_members.map(m => m.id) : []
    });
    setShowCreate(true);
  };

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.client_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Projects</h1>
        <button onClick={() => { setForm({ name: '', client_name: '', description: '', member_ids: [] }); setShowCreate(true); }} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px',
          background: '#f97316', border: 'none', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* Search + View Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(88,66,55,0.5)' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..."
            style={{ ...inputStyle, padding: '10px 12px 10px 34px', fontSize: '12px' }} />
        </div>
        <div style={{ display: 'flex', padding: '2px', borderRadius: '6px', background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)' }}>
          <button onClick={() => setView('grid')} style={{
            padding: '6px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
            background: view === 'grid' ? 'rgba(249,115,22,0.12)' : 'transparent',
            color: view === 'grid' ? '#ffb690' : 'rgba(88,66,55,0.6)',
          }}><LayoutGrid size={14} /></button>
          <button onClick={() => setView('list')} style={{
            padding: '6px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
            background: view === 'list' ? 'rgba(249,115,22,0.12)' : 'transparent',
            color: view === 'list' ? '#ffb690' : 'rgba(88,66,55,0.6)',
          }}><List size={14} /></button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div style={{ ...card, padding: '60px 20px', textAlign: 'center' }}>
          <FolderOpen size={40} style={{ color: 'rgba(88,66,55,0.5)', margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#e0c0b1', marginBottom: '6px' }}>No projects yet</h3>
          <p style={{ fontSize: '12px', color: 'rgba(88,66,55,0.5)' }}>Create your first project to get started</p>
        </div>
      ) : (
        <div style={view === 'grid'
          ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }
          : { display: 'flex', flexDirection: 'column', gap: '8px' }
        }>
          {filtered.map(p => {
            const sb = statusBadge[p.status] || statusBadge.active;
            return (
              <div key={p.id} style={{ ...card, padding: '18px', cursor: 'pointer', transition: 'border 150ms' }}
                onClick={() => openEdit(p)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(88,66,55,0.5)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(88,66,55,0.2)'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid rgba(88,66,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <FolderOpen size={16} style={{ color: '#f97316' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#ece0dc', marginBottom: '2px' }}>{p.name}</h3>
                      <p style={{ fontSize: '11px', color: 'rgba(88,66,55,0.5)' }}>{p.client_name || 'No client'}</p>
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: '4px',
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: sb.bg, color: sb.color,
                  }}>{p.status}</span>
                </div>
                {p.description && (
                  <p style={{ fontSize: '12px', color: 'rgba(88,66,55,0.6)', marginTop: '12px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.description}
                  </p>
                )}
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(88,66,55,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(88,66,55,0.5)' }}>Created {new Date(p.created_at).toLocaleDateString()}</span>
                  
                  {p.assigned_members && p.assigned_members.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {p.assigned_members.slice(0, 3).map((m, i) => (
                        <div key={m.id} style={{
                          width: '22px', height: '22px', borderRadius: '50%', background: '#f97316',
                          border: '2px solid #201a18', marginLeft: i > 0 ? '-6px' : 0, zIndex: 10 - i,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: 700, color: '#341100'
                        }} title={m.full_name}>
                          {m.full_name.substring(0, 2).toUpperCase()}
                        </div>
                      ))}
                      {p.assigned_members.length > 3 && (
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '50%', background: '#2a2220',
                          border: '2px solid #201a18', marginLeft: '-6px', zIndex: 6,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: 700, color: 'rgba(88,66,55,0.6)'
                        }}>
                          +{p.assigned_members.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setShowCreate(false)}>
          <div style={{ ...card, padding: '32px', width: '100%', maxWidth: '420px', animation: 'scaleIn 0.15s ease-out' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ece0dc' }}>{form.id ? 'Edit Project' : 'New Project'}</h2>
              <button type="button" onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'rgba(88,66,55,0.6)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={label}>Project Name</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="Brand Campaign Q4"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = '#f97316'} onBlur={e => e.target.style.borderColor = 'rgba(88,66,55,0.3)'} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={label}>Client Name</label>
                <input type="text" value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} placeholder="Acme Corp"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = '#f97316'} onBlur={e => e.target.style.borderColor = 'rgba(88,66,55,0.3)'} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={label}>Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder="Brief project description..."
                  style={{ ...inputStyle, resize: 'none' }} onFocus={e => e.target.style.borderColor = '#f97316'} onBlur={e => e.target.style.borderColor = 'rgba(88,66,55,0.3)'} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={label}>Team Members</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {users.map(u => (
                    <button key={u.id} type="button" onClick={() => {
                      const sel = form.member_ids.includes(u.id);
                      setForm({...form, member_ids: sel ? form.member_ids.filter(id => id !== u.id) : [...form.member_ids, u.id]});
                    }} style={{
                      padding: '6px 12px', borderRadius: '20px', border: '1px solid',
                      borderColor: form.member_ids.includes(u.id) ? '#f97316' : 'rgba(88,66,55,0.3)',
                      background: form.member_ids.includes(u.id) ? 'rgba(249,115,22,0.15)' : 'transparent',
                      color: form.member_ids.includes(u.id) ? '#ffb690' : 'rgba(167,139,125,0.6)',
                      fontSize: '12px', cursor: 'pointer', transition: 'all 150ms'
                    }}>
                      {u.full_name}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: 'transparent',
                  border: '1px solid rgba(88,66,55,0.3)', fontSize: '14px', fontWeight: 600, color: 'rgba(167,139,125,0.6)', cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: '#f97316',
                  border: 'none', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer',
                }}>{form.id ? 'Save Changes' : 'Create'}</button>
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
