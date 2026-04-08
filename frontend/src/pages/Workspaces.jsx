import { useState, useEffect } from 'react';
import { Building2, Plus, Shield, Search, Loader2, ArrowRight, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import api from '../api/client';
import useAuthStore from '../store/authStore';

export default function Workspaces() {
  const { user } = useAuthStore();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workspaceQuery, setWorkspaceQuery] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    org_name: '',
    owner_email: '',
    owner_full_name: '',
    owner_password: '',
  });
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [actionWorkspaceId, setActionWorkspaceId] = useState(null);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await api.get('/workspaces');
      setWorkspaces(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setModalError(null);
    try {
      const res = await api.post('/workspaces', modalForm);
      setWorkspaces((prev) => [res.data, ...prev]);
      setIsModalOpen(false);
      setModalForm({ org_name: '', owner_email: '', owner_full_name: '', owner_password: '' });
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const upsertWorkspace = (nextWorkspace) => {
    setWorkspaces((prev) => prev.map((ws) => (ws.id === nextWorkspace.id ? nextWorkspace : ws)));
    setSelectedWorkspace((prev) => (prev?.id === nextWorkspace.id ? nextWorkspace : prev));
  };

  const handlePauseToggle = async (workspace) => {
    setError(null);
    setActionWorkspaceId(workspace.id);
    try {
      const res = await api.patch(`/workspaces/${workspace.id}/pause`, { is_paused: !workspace.is_paused });
      upsertWorkspace(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update workspace status.');
    } finally {
      setActionWorkspaceId(null);
    }
  };

  const handleDeleteWorkspace = async (workspace) => {
    const confirmed = window.confirm(
      `Delete workspace "${workspace.name}"?\n\nThis action is permanent and removes all workspace data.`
    );
    if (!confirmed) return;

    setError(null);
    setActionWorkspaceId(workspace.id);
    try {
      await api.delete(`/workspaces/${workspace.id}`);
      setWorkspaces((prev) => prev.filter((ws) => ws.id !== workspace.id));
      setSelectedWorkspace((prev) => (prev?.id === workspace.id ? null : prev));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete workspace.');
    } finally {
      setActionWorkspaceId(null);
    }
  };

  const filteredWorkspaces = workspaces.filter((ws) => {
    const q = workspaceQuery.trim().toLowerCase();
    if (!q) return true;

    return (
      ws.name.toLowerCase().includes(q) ||
      ws.slug.toLowerCase().includes(q) ||
      ws.owner_name.toLowerCase().includes(q) ||
      ws.owner_email.toLowerCase().includes(q)
    );
  });

  if (!user?.is_superadmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">You do not have access to this page.</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      
      {/* Header Segment */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#ece0dc', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <Building2 color="#f97316" size={24} />
            Global Workspaces
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#8b8ba0' }}>
            Provision and manage all agency workspaces across the platform.
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setModalError(null); setIsModalOpen(true); }}>
          <Plus size={16} />
          Create Workspace
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.09)', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Main Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} color="#55556a" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search workspaces..." 
              className="input"
              value={workspaceQuery}
              onChange={(e) => setWorkspaceQuery(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
        </div>

        {/* Table wrapper */}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 12px' }} />
              Loading workspaces...
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th className="table-header">Workspace</th>
                  <th className="table-header">Workspace ID (Slug)</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Owner</th>
                  <th className="table-header">Users</th>
                  <th className="table-header">Created At</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkspaces.map((ws) => (
                  <tr key={ws.id} className="table-row">
                    <td className="table-cell">
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ws.name}</div>
                    </td>
                    <td className="table-cell">
                      <div style={{ display: 'inline-block', padding: '4px 8px', background: 'var(--accent-muted)', color: 'var(--accent)', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600 }}>
                        {ws.slug}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${ws.is_paused ? 'badge-yellow' : 'badge-green'}`}>
                        {ws.is_paused ? 'Paused' : 'Active'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {ws.owner_name[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{ws.owner_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ws.owner_email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell" style={{ color: 'var(--text-secondary)' }}>{ws.users_count}</td>
                    <td className="table-cell" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {new Date(ws.created_at).toLocaleDateString()}
                    </td>
                    <td className="table-cell" style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedWorkspace(ws)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                        title="Open workspace details"
                      >
                        <ArrowRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredWorkspaces.length === 0 && !loading && (
                  <tr>
                    <td colSpan="7" className="table-cell" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No workspaces found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, 
          background: 'rgba(5, 5, 10, 0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div className="card animate-in" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-card-hover)' }}>
              <Shield color="#eab308" size={20} />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Provision New Workspace</h2>
            </div>
            
            <form onSubmit={handleCreate} style={{ padding: '24px' }}>
              {modalError && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>
                  {modalError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>Organization Name</label>
                  <input
                    type="text"
                    required
                    value={modalForm.org_name}
                    onChange={(e) => setModalForm(prev => ({ ...prev, org_name: e.target.value }))}
                    className="input"
                    placeholder="Acme Agency"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>This defines the globally unique Workspace Slug.</p>
                </div>
                
                <div style={{ paddingTop: '12px', paddingBottom: '4px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Admin Account Setup</h3>
                </div>

                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>Admin Full Name</label>
                  <input
                    type="text"
                    required
                    value={modalForm.owner_full_name}
                    onChange={(e) => setModalForm(prev => ({ ...prev, owner_full_name: e.target.value }))}
                    className="input"
                    placeholder="John Doe"
                  />
                </div>
                
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>Admin Email</label>
                  <input
                    type="email"
                    required
                    value={modalForm.owner_email}
                    onChange={(e) => setModalForm(prev => ({ ...prev, owner_email: e.target.value }))}
                    className="input"
                    placeholder="john@acme.com"
                  />
                </div>
                
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>Temporary Password</label>
                  <input
                    type="text"
                    required
                    value={modalForm.owner_password}
                    onChange={(e) => setModalForm(prev => ({ ...prev, owner_password: e.target.value }))}
                    className="input"
                    placeholder="P@ssw0rd123"
                  />
                </div>
              </div>

              <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-outline"
                  style={{ border: 'none' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : null}
                  {creating ? "Provisioning..." : "Create Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedWorkspace && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 5, 10, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1100,
            padding: 20,
          }}
          onClick={() => setSelectedWorkspace(null)}
        >
          <div
            className="card micro-pop"
            style={{ width: 'min(560px, 100%)', padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>{selectedWorkspace.name}</h3>
              <span className="badge badge-orange">{selectedWorkspace.slug}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="card" style={{ padding: 14 }}>
                <div className="section-label">Owner</div>
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedWorkspace.owner_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedWorkspace.owner_email}</div>
              </div>
              <div className="card" style={{ padding: 14 }}>
                <div className="section-label">Users</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{selectedWorkspace.users_count}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Active members</div>
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-high)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge ${selectedWorkspace.is_paused ? 'badge-yellow' : 'badge-green'}`}>
                  {selectedWorkspace.is_paused ? 'Paused' : 'Active'}
                </span>
                {selectedWorkspace.paused_at && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Since {new Date(selectedWorkspace.paused_at).toLocaleString()}
                  </span>
                )}
              </div>
              {selectedWorkspace.can_manage ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-outline"
                    disabled={actionWorkspaceId === selectedWorkspace.id}
                    onClick={() => handlePauseToggle(selectedWorkspace)}
                  >
                    {selectedWorkspace.is_paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                    {selectedWorkspace.is_paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    disabled={actionWorkspaceId === selectedWorkspace.id}
                    onClick={() => handleDeleteWorkspace(selectedWorkspace)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '9px 14px',
                      borderRadius: 8,
                      border: '1px solid rgba(239,68,68,0.35)',
                      background: 'rgba(239,68,68,0.12)',
                      color: '#f87171',
                      cursor: actionWorkspaceId === selectedWorkspace.id ? 'not-allowed' : 'pointer',
                      opacity: actionWorkspaceId === selectedWorkspace.id ? 0.6 : 1,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Only the first-created superadmin can pause/delete workspaces.
                </span>
              )}
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Created {new Date(selectedWorkspace.created_at).toLocaleString()}
              </div>
              <button className="btn-outline" onClick={() => setSelectedWorkspace(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
