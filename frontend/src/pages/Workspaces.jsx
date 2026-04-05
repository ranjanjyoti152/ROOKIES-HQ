import React, { useState, useEffect } from 'react';
import { Building2, Plus, Shield, Search, Loader2, ArrowRight } from 'lucide-react';
import api from '../api/client';
import useAuthStore from '../store/authStore';

export default function Workspaces() {
  const { user } = useAuthStore();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    org_name: '',
    owner_email: '',
    owner_full_name: '',
    owner_password: '',
  });
  const [creating, setCreating] = useState(false);

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
    setError(null);
    try {
      const res = await api.post('/workspaces', modalForm);
      setWorkspaces([res.data, ...workspaces]);
      setIsModalOpen(false);
      setModalForm({ org_name: '', owner_email: '', owner_full_name: '', owner_password: '' });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

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
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Create Workspace
        </button>
      </div>

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
                  <th className="table-header">Owner</th>
                  <th className="table-header">Users</th>
                  <th className="table-header">Created At</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((ws) => (
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
                      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <ArrowRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {workspaces.length === 0 && !loading && (
                  <tr>
                    <td colSpan="6" className="table-cell" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
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
              {error && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>
                  {error}
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
    </div>
  );
}
