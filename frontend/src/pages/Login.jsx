import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { Bolt, Eye, EyeOff, AlertCircle, Building2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessLevel, setAccessLevel] = useState('admin');
  const [remember, setRemember] = useState(false);
  const [form, setForm] = useState({ orgName: '', fullName: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) await register(form.orgName, form.email, form.password, form.fullName);
      else await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong');
    } finally { setLoading(false); }
  };

  const levels = ['Admin', 'Editor', 'Client'];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#08080d', position: 'relative', overflow: 'hidden' }}>
      {/* Gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(20,30,60,0.4) 0%, transparent 60%)', pointerEvents: 'none' }} />

      {/* Center content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, padding: '40px 20px' }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '48px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#2d5fdf', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 0 50px rgba(45,95,223,0.2)' }}>
            <Bolt size={26} style={{ color: 'white' }} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '0.35em', color: '#d0d0e0', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
            Rookies HQ
          </h1>
          <p style={{ fontSize: '11px', letterSpacing: '0.35em', color: '#4a4a60', textTransform: 'uppercase', marginTop: '6px', fontWeight: 500 }}>
            Creative Agency Workflow OS
          </p>
        </div>

        {/* Card */}
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ background: '#0d0d14', border: '1px solid #1a1a28', borderRadius: '14px', padding: '36px 32px' }}>

            {/* Heading */}
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#e0e0ec', marginBottom: '4px' }}>
              {isRegister ? 'Create Workspace' : 'Sign In to Workspace'}
            </h2>
            <p style={{ fontSize: '13px', color: '#4a4a60', marginBottom: '28px' }}>
              {isRegister ? 'Set up your agency workspace to get started.' : 'Enter your credentials to access your studio tools.'}
            </p>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', marginBottom: '20px', borderRadius: '8px', background: '#1a0808', border: '1px solid #301010', color: '#ef4444', fontSize: '12px' }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {isRegister && (
                <>
                  {/* Org Name */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#5a5a70', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Organization Name
                    </label>
                    <input type="text" value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} required placeholder="Your Agency Name"
                      style={{ width: '100%', padding: '12px 16px', background: '#131320', border: '1px solid #1c1c2c', borderRadius: '8px', fontSize: '14px', color: '#c0c0d0', outline: 'none', boxSizing: 'border-box' }} 
                      onFocus={(e) => e.target.style.borderColor = '#2d5fdf'}
                      onBlur={(e) => e.target.style.borderColor = '#1c1c2c'}
                    />
                  </div>
                  {/* Full Name */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#5a5a70', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Full Name
                    </label>
                    <input type="text" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required placeholder="John Doe"
                      style={{ width: '100%', padding: '12px 16px', background: '#131320', border: '1px solid #1c1c2c', borderRadius: '8px', fontSize: '14px', color: '#c0c0d0', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={(e) => e.target.style.borderColor = '#2d5fdf'}
                      onBlur={(e) => e.target.style.borderColor = '#1c1c2c'}
                    />
                  </div>
                </>
              )}

              {/* Access Level */}
              {!isRegister && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#5a5a70', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Access Level
                  </label>
                  <div style={{ display: 'flex' }}>
                    {levels.map((level, i) => (
                      <button key={level} type="button" onClick={() => setAccessLevel(level.toLowerCase())}
                        style={{
                          flex: 1,
                          padding: '11px 0',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 150ms',
                          borderRadius: i === 0 ? '8px 0 0 8px' : i === 2 ? '0 8px 8px 0' : '0',
                          background: accessLevel === level.toLowerCase() ? 'rgba(45,95,223,0.12)' : '#131320',
                          border: accessLevel === level.toLowerCase() ? '1px solid #2d5fdf' : '1px solid #1c1c2c',
                          color: accessLevel === level.toLowerCase() ? '#5090ff' : '#5a5a70',
                          marginLeft: i > 0 ? '-1px' : '0',
                          position: 'relative',
                          zIndex: accessLevel === level.toLowerCase() ? 1 : 0,
                        }}
                      >{level}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Email */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#5a5a70', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Email Address
                </label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="name@agency.com"
                  style={{ width: '100%', padding: '12px 16px', background: '#131320', border: '1px solid #1c1c2c', borderRadius: '8px', fontSize: '14px', color: '#c0c0d0', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = '#2d5fdf'}
                  onBlur={(e) => e.target.style.borderColor = '#1c1c2c'}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#5a5a70', textTransform: 'uppercase' }}>
                    Password
                  </label>
                  {!isRegister && (
                    <button type="button" style={{ fontSize: '12px', color: '#2d5fdf', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="••••••••"
                    style={{ width: '100%', padding: '12px 44px 12px 16px', background: '#131320', border: '1px solid #1c1c2c', borderRadius: '8px', fontSize: '14px', color: '#c0c0d0', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={(e) => e.target.style.borderColor = '#2d5fdf'}
                    onBlur={(e) => e.target.style.borderColor = '#1c1c2c'}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#3a3a50', cursor: 'pointer', padding: 0 }}>
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Remember */}
              {!isRegister && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '24px' }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                    style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: '#2d5fdf' }} />
                  <span style={{ fontSize: '13px', color: '#5a5a70' }}>Remember this session</span>
                </label>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '14px', borderRadius: '8px', background: '#2d5fdf', color: 'white', fontSize: '15px', fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                    {isRegister ? 'Creating...' : 'Signing in...'}
                  </span>
                ) : (isRegister ? 'Create Workspace' : 'Sign In to Workspace')}
              </button>
            </form>

            {/* Divider */}
            {!isRegister && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: '#1c1c2c' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', color: '#3a3a50', textTransform: 'uppercase' }}>OR</span>
                  <div style={{ flex: 1, height: '1px', background: '#1c1c2c' }} />
                </div>

                {/* SSO */}
                <button style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '13px', borderRadius: '8px', background: 'transparent', border: '1px solid #1c1c2c', fontSize: '14px', fontWeight: 500, color: '#5a5a70', cursor: 'pointer' }}>
                  <Building2 size={17} />
                  Single Sign-On (SSO)
                </button>
              </>
            )}
          </div>

          {/* Toggle */}
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#4a4a60', marginTop: '24px' }}>
            {isRegister ? 'Already have a workspace?' : "Don't have a workspace?"}{' '}
            <button onClick={() => { setIsRegister(!isRegister); setError(''); }}
              style={{ color: '#2d5fdf', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
              {isRegister ? 'Sign In' : 'Create one'}
            </button>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, paddingBottom: '24px', paddingTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '28px', marginBottom: '12px' }}>
          {['Privacy Policy', 'Terms of Service', 'Help Center'].map((link) => (
            <button key={link} style={{ fontSize: '12px', color: '#2a2a3a', background: 'none', border: 'none', cursor: 'pointer' }}>
              {link}
            </button>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: '11px', letterSpacing: '0.15em', color: '#1e1e2c', textTransform: 'uppercase' }}>
          © 2024 Rookies HQ
        </p>
        <div style={{ position: 'absolute', bottom: '24px', left: '24px' }}>
          <span style={{ fontSize: '10px', letterSpacing: '0.2em', color: '#1e1e30', textTransform: 'uppercase', fontWeight: 600 }}>
            System Status: <span style={{ color: '#2a2a40' }}>Active</span>
          </span>
        </div>
      </footer>

      {/* Spin animation for loader */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
