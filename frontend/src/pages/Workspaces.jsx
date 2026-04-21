import { useState, useEffect } from 'react';
import { Building2, Plus, Shield, Search, Loader2, ArrowRight, PauseCircle, PlayCircle, Trash2, KeyRound } from 'lucide-react';
import api from '../api/client';
import useAuthStore from '../store/authStore';
import { ConfirmDialog, PromptDialog } from '../components/ui/Dialogs';

function getApiErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === 'string' && first.trim()) return first;
    if (first && typeof first === 'object' && typeof first.msg === 'string') return first.msg;
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string' && detail.message.trim()) return detail.message;
  }
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return fallback;
}

function normalizeWorkspace(ws) {
  const safe = ws || {};
  const rawServices = safe.services && typeof safe.services === 'object' ? safe.services : {};
  const normalizedServices = Object.fromEntries(
    Object.entries(rawServices).map(([key, value]) => [key, Boolean(value)])
  );
  return {
    id: safe.id ?? '',
    name: safe.name ?? 'Untitled Workspace',
    slug: safe.slug ?? 'unknown',
    is_paused: Boolean(safe.is_paused),
    paused_at: safe.paused_at ?? null,
    owner_name: safe.owner_name ?? 'Unknown',
    owner_email: safe.owner_email ?? 'Unknown',
    users_count: Number.isFinite(safe.users_count) ? safe.users_count : 0,
    created_at: safe.created_at ?? new Date().toISOString(),
    can_manage: Boolean(safe.can_manage),
    services: normalizedServices,
  };
}

function getApiFieldErrors(err) {
  const detail = err?.response?.data?.detail;
  const fieldErrors = {};
  if (!Array.isArray(detail)) return fieldErrors;

  for (const item of detail) {
    if (!item || typeof item !== 'object') continue;
    const loc = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : null;
    const msg = typeof item.msg === 'string' ? item.msg : 'Invalid value';
    if (typeof loc === 'string') {
      fieldErrors[loc] = msg;
    }
  }

  return fieldErrors;
}

function validateWorkspaceForm(form) {
  const errors = {};
  if ((form.org_name || '').trim().length < 2) {
    errors.org_name = 'Organization name must be at least 2 characters.';
  }
  if ((form.owner_full_name || '').trim().length < 2) {
    errors.owner_full_name = 'Admin full name must be at least 2 characters.';
  }
  if ((form.owner_password || '').length < 8) {
    errors.owner_password = 'Temporary password must be at least 8 characters.';
  }
  return errors;
}

export default function Workspaces() {
  const { user } = useAuthStore();
  const [workspaces, setWorkspaces] = useState([]);
  const [serviceCatalog, setServiceCatalog] = useState([]);
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [modalStep, setModalStep] = useState('form');
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [actionWorkspaceId, setActionWorkspaceId] = useState(null);
  const [serviceSavingKey, setServiceSavingKey] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ workspace: null, busy: false });
  const [ownerPasswordDialog, setOwnerPasswordDialog] = useState({ workspace: null, busy: false, error: '' });

  useEffect(() => {
    fetchWorkspaces();
    fetchServiceCatalog();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await api.get('/workspaces');
      setWorkspaces(Array.isArray(res.data) ? res.data.map(normalizeWorkspace) : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load workspaces'));
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceCatalog = async () => {
    try {
      const res = await api.get('/workspaces/service-catalog');
      const rows = Array.isArray(res.data) ? res.data : [];
      setServiceCatalog(rows.filter((row) => row && row.key).map((row) => ({
        key: String(row.key),
        label: String(row.label || row.key),
      })));
    } catch {
      setServiceCatalog([
        { key: 'ai_assistant', label: 'AI Assistant' },
      ]);
    }
  };

  const resetModal = () => {
    setIsModalOpen(false);
    setModalStep('form');
    setOtpCode('');
    setOtpEmail('');
    setModalError(null);
    setFieldErrors({});
    setModalForm({ org_name: '', owner_email: '', owner_full_name: '', owner_password: '' });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const validationErrors = validateWorkspaceForm(modalForm);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setModalError(null);
      return;
    }

    setCreating(true);
    setModalError(null);
    setFieldErrors({});
    try {
      const res = await api.post('/workspaces/initiate', modalForm);
      setOtpEmail(res.data?.owner_email || modalForm.owner_email);
      setOtpCode('');
      setModalStep('otp');
      setModalError(null);
    } catch (err) {
      const apiFieldErrors = getApiFieldErrors(err);
      if (Object.keys(apiFieldErrors).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...apiFieldErrors }));
        setModalError(null);
      } else {
        setModalError(getApiErrorMessage(err, 'Failed to send OTP'));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if ((otpCode || '').trim().length !== 6) {
      setModalError('Please enter the 6-digit OTP sent to email.');
      return;
    }

    setCreating(true);
    setModalError(null);
    try {
      const res = await api.post('/workspaces/verify', {
        owner_email: otpEmail || modalForm.owner_email,
        otp: otpCode.trim(),
      });
      const created = normalizeWorkspace(res.data);
      setWorkspaces((prev) => [created, ...prev]);
      resetModal();
    } catch (err) {
      setModalError(getApiErrorMessage(err, 'Failed to verify OTP and create workspace'));
    } finally {
      setCreating(false);
    }
  };

  const handleResendOtp = async () => {
    setCreating(true);
    setModalError(null);
    try {
      const res = await api.post('/workspaces/initiate', modalForm);
      setOtpEmail(res.data?.owner_email || modalForm.owner_email);
      setOtpCode('');
    } catch (err) {
      setModalError(getApiErrorMessage(err, 'Failed to resend OTP'));
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
      upsertWorkspace(normalizeWorkspace(res.data));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update workspace status.'));
    } finally {
      setActionWorkspaceId(null);
    }
  };

  const handleDeleteWorkspace = async (workspace) => {
    setDeleteDialog({ workspace, busy: false });
  };

  const confirmDeleteWorkspace = async () => {
    const workspace = deleteDialog.workspace;
    if (!workspace) return;
    setError(null);
    setDeleteDialog((prev) => ({ ...prev, busy: true }));
    setActionWorkspaceId(workspace.id);
    try {
      await api.delete(`/workspaces/${workspace.id}`);
      setWorkspaces((prev) => prev.filter((ws) => ws.id !== workspace.id));
      setSelectedWorkspace((prev) => (prev?.id === workspace.id ? null : prev));
      setDeleteDialog({ workspace: null, busy: false });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete workspace.'));
    } finally {
      setDeleteDialog((prev) => ({ ...prev, busy: false }));
      setActionWorkspaceId(null);
    }
  };

  const handleResetOwnerPassword = async (workspace) => {
    setOwnerPasswordDialog({ workspace, busy: false, error: '' });
  };

  const submitOwnerPasswordReset = async (nextPassword) => {
    const workspace = ownerPasswordDialog.workspace;
    if (!workspace) return;
    if ((nextPassword || '').length < 8) {
      setOwnerPasswordDialog((prev) => ({ ...prev, error: 'Temporary owner password must be at least 8 characters.' }));
      return;
    }

    setOwnerPasswordDialog((prev) => ({ ...prev, busy: true, error: '' }));
    setError(null);
    setActionWorkspaceId(workspace.id);
    try {
      await api.post(`/workspaces/${workspace.id}/owner-password/reset`, {
        new_password: nextPassword,
      });
      setOwnerPasswordDialog({ workspace: null, busy: false, error: '' });
      setError(`Owner password reset for "${workspace.name}". Credentials sent to owner and superadmin email.`);
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to reset workspace owner password.');
      setOwnerPasswordDialog((prev) => ({ ...prev, error: message }));
      setError(message);
    } finally {
      setOwnerPasswordDialog((prev) => ({ ...prev, busy: false }));
      setActionWorkspaceId(null);
    }
  };

  const handleToggleWorkspaceService = async (workspace, serviceKey, enabled) => {
    const nextServices = {
      ...(workspace.services || {}),
      [serviceKey]: enabled,
    };
    const loadingKey = `${workspace.id}:${serviceKey}`;
    setServiceSavingKey(loadingKey);
    setError(null);
    try {
      const res = await api.patch(`/workspaces/${workspace.id}/services`, {
        services: nextServices,
      });
      const updated = normalizeWorkspace(res.data);
      upsertWorkspace(updated);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update workspace services.'));
    } finally {
      setServiceSavingKey('');
    }
  };

  const filteredWorkspaces = workspaces.filter((ws) => {
    const q = workspaceQuery.trim().toLowerCase();
    if (!q) return true;

    return (
      ws.name.toLowerCase().includes(q) ||
      ws.slug.toLowerCase().includes(q) ||
      String(ws.owner_name || '').toLowerCase().includes(q) ||
      String(ws.owner_email || '').toLowerCase().includes(q)
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
        <button
          className="btn-primary"
          onClick={() => {
            setModalError(null);
            setFieldErrors({});
            setModalStep('form');
            setOtpCode('');
            setOtpEmail('');
            setIsModalOpen(true);
          }}
        >
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
                          {String(ws.owner_name || '?').charAt(0).toUpperCase()}
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
        <div className="ui-overlay" style={{ zIndex: 1000, padding: '20px' }}>
          <div className="ui-subwindow card animate-in" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-card-hover)' }}>
              <Shield color="#eab308" size={20} />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Provision New Workspace</h2>
            </div>
            
            <form onSubmit={modalStep === 'form' ? handleCreate : handleVerifyOtp} style={{ padding: '24px' }}>
              {modalError && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>
                  {modalError}
                </div>
              )}

              {modalStep === 'form' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>Organization Name</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={modalForm.org_name}
                      onChange={(e) => {
                        const value = e.target.value;
                        setModalForm(prev => ({ ...prev, org_name: value }));
                        if (fieldErrors.org_name) {
                          setFieldErrors(prev => ({ ...prev, org_name: null }));
                        }
                      }}
                      className="input"
                      placeholder="Acme Agency"
                    />
                    {fieldErrors.org_name && (
                      <p style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>{fieldErrors.org_name}</p>
                    )}
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
                      minLength={2}
                      value={modalForm.owner_full_name}
                      onChange={(e) => {
                        const value = e.target.value;
                        setModalForm(prev => ({ ...prev, owner_full_name: value }));
                        if (fieldErrors.owner_full_name) {
                          setFieldErrors(prev => ({ ...prev, owner_full_name: null }));
                        }
                      }}
                      className="input"
                      placeholder="John Doe"
                    />
                    {fieldErrors.owner_full_name && (
                      <p style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>{fieldErrors.owner_full_name}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>Admin Email</label>
                    <input
                      type="email"
                      required
                      value={modalForm.owner_email}
                      onChange={(e) => {
                        const value = e.target.value;
                        setModalForm(prev => ({ ...prev, owner_email: value }));
                        if (fieldErrors.owner_email) {
                          setFieldErrors(prev => ({ ...prev, owner_email: null }));
                        }
                      }}
                      className="input"
                      placeholder="john@acme.com"
                    />
                    {fieldErrors.owner_email && (
                      <p style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>{fieldErrors.owner_email}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>Temporary Password (min 8 chars)</label>
                    <input
                      type="text"
                      required
                      minLength={8}
                      value={modalForm.owner_password}
                      onChange={(e) => {
                        const value = e.target.value;
                        setModalForm(prev => ({ ...prev, owner_password: value }));
                        if (fieldErrors.owner_password) {
                          setFieldErrors(prev => ({ ...prev, owner_password: null }));
                        }
                      }}
                      className="input"
                      placeholder="P@ssw0rd123"
                    />
                    {fieldErrors.owner_password ? (
                      <p style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>{fieldErrors.owner_password}</p>
                    ) : (
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>Must be at least 8 characters.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                    OTP sent to <strong style={{ color: 'var(--text-primary)' }}>{otpEmail || modalForm.owner_email}</strong>.
                    Verify it to create the workspace.
                  </p>
                  <div>
                    <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>Email OTP</label>
                    <input
                      type="text"
                      required
                      minLength={6}
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="input"
                      placeholder="Enter 6-digit OTP"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={creating}
                    className="btn-outline"
                    onClick={handleResendOtp}
                    style={{ width: 'fit-content' }}
                  >
                    Resend OTP
                  </button>
                </div>
              )}

              <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={resetModal}
                  className="btn-outline"
                  style={{ border: 'none' }}
                >
                  Cancel
                </button>
                {modalStep === 'otp' && (
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={creating}
                    onClick={() => {
                      setModalStep('form');
                      setModalError(null);
                    }}
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : null}
                  {creating
                    ? (modalStep === 'form' ? 'Sending OTP...' : 'Verifying...')
                    : (modalStep === 'form' ? 'Send OTP' : 'Verify & Create Workspace')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedWorkspace && (
        <div
          className="ui-overlay"
          style={{ zIndex: 1100, padding: 20 }}
          onClick={() => setSelectedWorkspace(null)}
        >
          <div
            className="ui-subwindow card micro-pop"
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
                    onClick={() => handleResetOwnerPassword(selectedWorkspace)}
                  >
                    <KeyRound size={14} />
                    Reset Owner Password
                  </button>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="btn-outline"
                    disabled={actionWorkspaceId === selectedWorkspace.id}
                    onClick={() => handleResetOwnerPassword(selectedWorkspace)}
                  >
                    <KeyRound size={14} />
                    Reset Owner Password
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Only the first-created superadmin can pause/delete workspaces.
                  </span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 12 }} className="card">
              <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
                <div className="section-label" style={{ marginBottom: 6 }}>Workspace Services</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Superadmin controls for this workspace.
                </div>
              </div>
              <div style={{ padding: 12, display: 'grid', gap: 10 }}>
                {(serviceCatalog.length ? serviceCatalog : [{ key: 'ai_assistant', label: 'AI Assistant' }]).map((item) => {
                  const checked = Boolean(selectedWorkspace.services?.[item.key]);
                  const loadingKey = `${selectedWorkspace.id}:${item.key}`;
                  const isSavingThis = serviceSavingKey === loadingKey;
                  return (
                    <label
                      key={item.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        background: 'var(--bg-card-hover)',
                        opacity: isSavingThis ? 0.7 : 1,
                      }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                        {item.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isSavingThis}
                        onChange={(e) => handleToggleWorkspaceService(selectedWorkspace, item.key, e.target.checked)}
                      />
                    </label>
                  );
                })}
              </div>
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

      <ConfirmDialog
        open={!!deleteDialog.workspace}
        title={`Delete Workspace${deleteDialog.workspace ? ` · ${deleteDialog.workspace.name}` : ''}`}
        message="This action is permanent and removes all workspace data."
        confirmText="Delete Workspace"
        cancelText="Cancel"
        danger
        busy={deleteDialog.busy}
        onCancel={() => setDeleteDialog({ workspace: null, busy: false })}
        onConfirm={confirmDeleteWorkspace}
      />

      <PromptDialog
        open={!!ownerPasswordDialog.workspace}
        title={`Reset Owner Password${ownerPasswordDialog.workspace ? ` · ${ownerPasswordDialog.workspace.name}` : ''}`}
        message="Set temporary owner password. Credentials will be emailed to owner and superadmin."
        label="Temporary Owner Password"
        type="password"
        minLength={8}
        defaultValue=""
        confirmText="Reset Password"
        error={ownerPasswordDialog.error}
        busy={ownerPasswordDialog.busy}
        onValueChange={() => setOwnerPasswordDialog((prev) => ({ ...prev, error: '' }))}
        onCancel={() => setOwnerPasswordDialog({ workspace: null, busy: false, error: '' })}
        onSubmit={submitOwnerPasswordReset}
      />
    </div>
  );
}
