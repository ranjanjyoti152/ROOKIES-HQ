import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import useAuthStore from '../../store/authStore';
import useToastStore from '../../store/toastStore';

export default function MainLayout() {
  const { user, changePassword } = useAuthStore();
  const { pushToast } = useToastStore();
  const [passwordForm, setPasswordForm] = useState({
    new_password: '',
    confirm_password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleForcedPasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if ((passwordForm.new_password || '').length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    try {
      setSubmitting(true);
      await changePassword(passwordForm.new_password, { skipCurrentCheck: true });
      setPasswordForm({ new_password: '', confirm_password: '' });
      pushToast({
        type: 'success',
        title: 'Password updated',
        message: 'Your password has been changed successfully.',
      });
    } catch (err) {
      setPasswordError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: 'radial-gradient(1200px 600px at 12% -20%, rgba(249,115,22,0.14), transparent), radial-gradient(900px 520px at 100% -10%, rgba(168,85,247,0.08), transparent), #120d0b',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), transparent 16%), radial-gradient(circle at 20% 80%, rgba(249,115,22,0.06), transparent 32%)',
      }} />
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <TopBar />
        <main style={{
          flex: 1, overflow: 'auto',
          padding: '28px 32px',
          background: 'linear-gradient(180deg, rgba(24,18,16,0.84), rgba(24,18,16,0.96))',
        }}>
          <Outlet />
        </main>
      </div>

      {user?.must_change_password && (
        <div
          className="ui-overlay"
          style={{ zIndex: 2000, padding: 20, backdropFilter: 'blur(2px)' }}
        >
          <div
            className="ui-subwindow card"
            style={{ width: 'min(520px, 100%)', padding: 24 }}
          >
            <h2 style={{ margin: 0, marginBottom: 8, fontSize: 20, color: 'var(--text-primary)' }}>
              Change Temporary Password
            </h2>
            <p style={{ margin: 0, marginBottom: 18, fontSize: 13, color: 'var(--text-muted)' }}>
              This account is using a temporary password. Please set a new password to continue.
            </p>

            {passwordError && (
              <div style={{
                marginBottom: 14,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid rgba(239,68,68,0.25)',
                background: 'rgba(239,68,68,0.09)',
                color: '#f87171',
                fontSize: 12,
              }}>
                {passwordError}
              </div>
            )}

            <form onSubmit={handleForcedPasswordChange}>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))}
                    className="input"
                    placeholder="Minimum 8 characters"
                  />
                </div>
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                    className="input"
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
