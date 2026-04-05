import { useState, useEffect } from 'react';
import api from '../api/client';
import { Plus, FolderOpen, Search, LayoutGrid, List, X } from 'lucide-react';

const card = { background: '#0d0d14', border: '1px solid #1a1a28', borderRadius: '10px' };
const label = { display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#5a5a70', textTransform: 'uppercase', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '12px 16px', background: '#131320', border: '1px solid #1c1c2c', borderRadius: '8px', fontSize: '14px', color: '#c0c0d0', outline: 'none', boxSizing: 'border-box' };

const statusBadge = {
  active: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e' },
  paused: { bg: 'rgba(234,179,8,0.12)', color: '#eab308' },
  completed: { bg: 'rgba(45,95,223,0.12)', color: '#5090ff' },
  archived: { bg: '#1a1a28', color: '#4a4a60' },
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', client_name: '', description: '' });

  const fetchProjects = async () => { try { const r = await api.get('/projects'); setProjects(r.data); } catch {} finally { setLoading(false); } };
  useEffect(() => { fetchProjects(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try { await api.post('/projects', form); setShowCreate(false); setForm({ name: '', client_name: '', description: '' }); fetchProjects(); } catch {}
  };

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.client_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e0e0ec' }}>Projects</h1>
        <button onClick={() => setShowCreate(true)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px',
          background: '#2d5fdf', border: 'none', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* Search + View Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#3a3a50' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..."
            style={{ ...inputStyle, padding: '10px 12px 10px 34px', fontSize: '12px' }} />
        </div>
        <div style={{ display: 'flex', padding: '2px', borderRadius: '6px', background: '#0d0d14', border: '1px solid #1a1a28' }}>
          <button onClick={() => setView('grid')} style={{
            padding: '6px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
            background: view === 'grid' ? 'rgba(45,95,223,0.12)' : 'transparent',
            color: view === 'grid' ? '#5090ff' : '#4a4a60',
          }}><LayoutGrid size={14} /></button>
          <button onClick={() => setView('list')} style={{
            padding: '6px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
            background: view === 'list' ? 'rgba(45,95,223,0.12)' : 'transparent',
            color: view === 'list' ? '#5090ff' : '#4a4a60',
          }}><List size={14} /></button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div style={{ ...card, padding: '60px 20px', textAlign: 'center' }}>
          <FolderOpen size={40} style={{ color: '#2a2a3a', margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#c0c0d0', marginBottom: '6px' }}>No projects yet</h3>
          <p style={{ fontSize: '12px', color: '#3a3a50' }}>Create your first project to get started</p>
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
                onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a3a'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#1a1a28'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '8px', background: '#101018',
                      border: '1px solid #151520', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <FolderOpen size={16} style={{ color: '#2d5fdf' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#d0d0e0', marginBottom: '2px' }}>{p.name}</h3>
                      <p style={{ fontSize: '11px', color: '#3a3a50' }}>{p.client_name || 'No client'}</p>
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: '4px',
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: sb.bg, color: sb.color,
                  }}>{p.status}</span>
                </div>
                {p.description && (
                  <p style={{ fontSize: '12px', color: '#4a4a60', marginTop: '12px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {p.description}
                  </p>
                )}
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #151520' }}>
                  <span style={{ fontSize: '10px', color: '#3a3a50' }}>Created {new Date(p.created_at).toLocaleDateString()}</span>
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
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e0e0ec' }}>New Project</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '20px' }}>
                <label style={label}>Project Name</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="Brand Campaign Q4"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = '#2d5fdf'} onBlur={e => e.target.style.borderColor = '#1c1c2c'} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={label}>Client Name</label>
                <input type="text" value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} placeholder="Acme Corp"
                  style={inputStyle} onFocus={e => e.target.style.borderColor = '#2d5fdf'} onBlur={e => e.target.style.borderColor = '#1c1c2c'} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={label}>Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder="Brief project description..."
                  style={{ ...inputStyle, resize: 'none' }} onFocus={e => e.target.style.borderColor = '#2d5fdf'} onBlur={e => e.target.style.borderColor = '#1c1c2c'} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: 'transparent',
                  border: '1px solid #1c1c2c', fontSize: '14px', fontWeight: 600, color: '#6a6a80', cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: '#2d5fdf',
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
