import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../api/client';
import {
  Bolt, Eye, EyeOff, AlertCircle, Building2, Mail,
  ArrowLeft, RotateCcw, Hash, Shield,
} from 'lucide-react';

const inputStyle = {
  width: '100%', padding: '12px 16px', background: '#131320',
  border: '1px solid #1c1c2c', borderRadius: '8px', fontSize: '14px',
  color: '#c0c0d0', outline: 'none', boxSizing: 'border-box',
};
const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 700,
  letterSpacing: '0.1em', color: '#5a5a70', textTransform: 'uppercase', marginBottom: '8px',
};

function Spinner({ text }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
      {text}
    </span>
  );
}

function FieldInput({ label, type = 'text', value, onChange, placeholder, hint, showToggle, onToggle, showPass }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={showToggle ? (showPass ? 'text' : 'password') : type}
          value={value}
          onChange={onChange}
          required
          placeholder={placeholder}
          style={{ ...inputStyle, paddingRight: showToggle ? '44px' : '16px', borderColor: focused ? '#2d5fdf' : '#1c1c2c' }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {showToggle && (
          <button type="button" onClick={onToggle} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#3a3a50', cursor: 'pointer', padding: 0 }}>
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {hint && <p style={{ fontSize: '11px', color: '#2e2e44', marginTop: '4px' }}>{hint}</p>}
    </div>
  );
}

// Steps: 'loading' | 'login' | 'signup' | 'otp'
// signupMode: 'create' (first user → admin) | 'join' (subsequent → editor)
export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [step, setStep] = useState('loading');
  const [signupMode, setSignupMode] = useState('join'); // will be set by setup-status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ orgName: '', orgSlug: '', fullName: '', email: '', password: '' });
  const [pendingOrgName, setPendingOrgName] = useState('');

  const f = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const fSlug = (e) => setForm((prev) => ({ ...prev, orgSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }));

  // OTP
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef([]);
  const cooldownRef = useRef(null);

  // ── Check setup status on mount ────────────────────────────────
  useEffect(() => {
    api.get('/auth/setup-status').then((res) => {
      setSignupMode(res.data.needs_setup ? 'create' : 'join');
      setStep('login');
    }).catch(() => {
      setStep('login'); // default to login if check fails
    });
  }, []);

  const startCooldown = () => {
    setResendCooldown(30);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // OTP digit handlers
  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft'  && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus();
  };
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = pasted.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // ── Submit: Login ────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  // ── Submit: Signup (create OR join) — sends OTP ──────────────────
  const handleSignupInitiate = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let res;
      if (signupMode === 'create') {
        res = await api.post('/auth/register/initiate', {
          org_name: form.orgName, email: form.email,
          password: form.password, full_name: form.fullName,
        });
        setPendingOrgName(form.orgName);
      } else {
        res = await api.post('/auth/join/initiate', {
          org_slug: form.orgSlug, email: form.email,
          password: form.password, full_name: form.fullName,
        });
        setPendingOrgName(res.data.org_name || form.orgSlug);
      }
      setStep('otp');
      setOtp(['', '', '', '', '', '']);
      startCooldown();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  // ── Submit: OTP verify ────────────────────────────────────────────
  const handleOtpVerify = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Enter all 6 digits'); return; }
    setError(''); setLoading(true);
    try {
      let res;
      if (signupMode === 'create') {
        res = await api.post('/auth/register/verify', { email: form.email, otp: code });
      } else {
        res = await api.post('/auth/join/verify', { email: form.email, otp: code, org_slug: form.orgSlug });
      }
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired OTP');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      if (signupMode === 'create') {
        await api.post('/auth/register/initiate', {
          org_name: form.orgName, email: form.email,
          password: form.password, full_name: form.fullName,
        });
      } else {
        await api.post('/auth/join/initiate', {
          org_slug: form.orgSlug, email: form.email,
          password: form.password, full_name: form.fullName,
        });
      }
      setOtp(['', '', '', '', '', '']);
      setError('');
      startCooldown();
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend');
    }
  };

  // ── Render Helpers ────────────────────────────────────────────────
  const isCreate = signupMode === 'create';

  const signupButtonLabel = isCreate ? 'Send Verification Code' : 'Send Verification Code';
  const signupButtonLoadLabel = isCreate ? 'Sending code...' : 'Sending code...';

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#08080d', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(20,30,60,0.45) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, padding: '40px 20px' }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '36px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#2d5fdf', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', boxShadow: '0 0 50px rgba(45,95,223,0.25)' }}>
            <Bolt size={24} style={{ color: 'white' }} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.35em', color: '#d0d0e0', textTransform: 'uppercase', margin: 0 }}>Rookies HQ</h1>
          <p style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#3a3a54', textTransform: 'uppercase', marginTop: '5px', fontWeight: 500 }}>Creative Agency Workflow OS</p>
        </div>

        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Loading state */}
          {step === 'loading' && (
            <div style={{ textAlign: 'center', color: '#3a3a50', fontSize: '13px', padding: '40px' }}>
              <span style={{ display: 'inline-block', width: '20px', height: '20px', border: '2px solid #2a2a40', borderTopColor: '#2d5fdf', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {step !== 'loading' && (
            <div style={{ background: '#0d0d14', border: '1px solid #1a1a28', borderRadius: '14px', padding: '32px' }}>

              {/* ─── OTP STEP ────────────────────────────────── */}
              {step === 'otp' && (
                <>
                  <button onClick={() => { setStep('signup'); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '20px', padding: 0 }}>
                    <ArrowLeft size={13} /> Back
                  </button>
                  <div style={{ width: '44px', height: '44px', borderRadius: '11px', background: 'rgba(45,95,223,0.1)', border: '1px solid rgba(45,95,223,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                    <Mail size={20} style={{ color: '#2d5fdf' }} />
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e0e0ec', marginBottom: '6px' }}>Check your email</h2>
                  <p style={{ fontSize: '13px', color: '#4a4a60', marginBottom: '4px', lineHeight: 1.6 }}>
                    6-digit code sent to <strong style={{ color: '#8080a0' }}>{form.email}</strong>
                  </p>
                  <p style={{ fontSize: '11px', color: '#3a3a50', marginBottom: '20px' }}>
                    Workspace: <strong style={{ color: '#5a5a70' }}>{pendingOrgName}</strong>
                  </p>

                  {error && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '16px', borderRadius: '8px', background: '#1a0808', border: '1px solid #2a1010', color: '#ef4444', fontSize: '12px' }}><AlertCircle size={13} /> {error}</div>}

                  <form onSubmit={handleOtpVerify}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                      {otp.map((digit, i) => (
                        <input key={i} ref={el => otpRefs.current[i] = el}
                          type="text" inputMode="numeric" maxLength={1} value={digit}
                          onChange={e => handleOtpChange(i, e.target.value)}
                          onKeyDown={e => handleOtpKeyDown(i, e)}
                          onPaste={i === 0 ? handleOtpPaste : undefined}
                          style={{ width: '46px', height: '56px', textAlign: 'center', fontSize: '22px', fontWeight: 800, color: '#e0e0ec', background: '#131320', border: `2px solid ${digit ? '#2d5fdf' : '#1c1c2c'}`, borderRadius: '10px', outline: 'none', caretColor: '#2d5fdf', transition: 'border-color 100ms' }}
                          onFocus={e => { e.target.style.borderColor = '#2d5fdf'; e.target.style.background = '#0e0e1e'; }}
                          onBlur={e => { e.target.style.borderColor = digit ? '#2d5fdf' : '#1c1c2c'; e.target.style.background = '#131320'; }}
                        />
                      ))}
                    </div>
                    <button type="submit" disabled={loading || otp.join('').length < 6}
                      style={{ width: '100%', padding: '13px', borderRadius: '8px', background: '#2d5fdf', color: 'white', fontSize: '14px', fontWeight: 600, border: 'none', cursor: (loading || otp.join('').length < 6) ? 'not-allowed' : 'pointer', opacity: (loading || otp.join('').length < 6) ? 0.5 : 1, marginBottom: '14px' }}>
                      {loading ? <Spinner text="Verifying..." /> : (isCreate ? 'Verify & Create Workspace' : 'Verify & Join Workspace')}
                    </button>
                  </form>
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={handleResend} disabled={resendCooldown > 0}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', fontSize: '12px', fontWeight: 600, cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', color: resendCooldown > 0 ? '#3a3a50' : '#2d5fdf' }}>
                      <RotateCcw size={12} />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </button>
                  </div>
                </>
              )}

              {/* ─── LOGIN STEP ──────────────────────────────── */}
              {step === 'login' && (
                <>
                  <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#e0e0ec', marginBottom: '4px' }}>Sign In</h2>
                  <p style={{ fontSize: '13px', color: '#4a4a60', marginBottom: '24px' }}>Enter your credentials to access your workspace.</p>

                  {error && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '16px', borderRadius: '8px', background: '#1a0808', border: '1px solid #2a1010', color: '#ef4444', fontSize: '12px' }}><AlertCircle size={13} /> {error}</div>}

                  <form onSubmit={handleLogin}>
                    <FieldInput label="Email Address" type="email" value={form.email} onChange={f('email')} placeholder="name@agency.com" />
                    <FieldInput label="Password" value={form.password} onChange={f('password')} placeholder="••••••••" showToggle onToggle={() => setShowPass(p => !p)} showPass={showPass} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: '6px 0 20px' }}>
                      <input type="checkbox" style={{ width: '15px', height: '15px', accentColor: '#2d5fdf' }} />
                      <span style={{ fontSize: '13px', color: '#5a5a70' }}>Remember this session</span>
                    </label>
                    <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: '8px', background: '#2d5fdf', color: 'white', fontSize: '14px', fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
                      {loading ? <Spinner text="Signing in..." /> : 'Sign In to Workspace'}
                    </button>
                  </form>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '18px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: '#161622' }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: '#252535', textTransform: 'uppercase' }}>
                      {isCreate ? 'First time here?' : 'New here?'}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: '#161622' }} />
                  </div>

                  <button onClick={() => { setStep('signup'); setError(''); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', borderRadius: '8px', background: 'rgba(45,95,223,0.08)', border: '1px solid rgba(45,95,223,0.22)', fontSize: '14px', fontWeight: 600, color: '#5d86ef', cursor: 'pointer', transition: 'all 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,95,223,0.14)'; e.currentTarget.style.borderColor = '#2d5fdf'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(45,95,223,0.08)'; e.currentTarget.style.borderColor = 'rgba(45,95,223,0.22)'; }}>
                    {isCreate ? <><Shield size={15} /> Sign Up — Create Workspace</> : <><Building2 size={15} /> Sign Up — Join a Workspace</>}
                  </button>
                </>
              )}

              {/* ─── SIGNUP STEP ─────────────────────────────── */}
              {step === 'signup' && (
                <>
                  <button onClick={() => { setStep('login'); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '20px', padding: 0 }}>
                    <ArrowLeft size={13} /> Back to sign in
                  </button>

                  {/* Icon + heading changes based on mode */}
                  <div style={{ width: '44px', height: '44px', borderRadius: '11px', background: isCreate ? 'rgba(45,95,223,0.08)' : 'rgba(45,95,223,0.08)', border: `1px solid ${isCreate ? 'rgba(234,179,8,0.25)' : 'rgba(45,95,223,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                    {isCreate ? <Shield size={20} style={{ color: '#eab308' }} /> : <Building2 size={20} style={{ color: '#5080df' }} />}
                  </div>

                  {isCreate ? (
                    <>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e0e0ec', marginBottom: '4px' }}>Create Workspace</h2>
                      <p style={{ fontSize: '13px', color: '#4a4a60', marginBottom: '6px', lineHeight: 1.6 }}>No workspace exists yet — you'll be the <strong style={{ color: '#eab308' }}>Admin</strong>.</p>
                      {/* Admin badge */}
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', marginBottom: '20px' }}>
                        <Shield size={11} style={{ color: '#eab308' }} />
                        <span style={{ fontSize: '11px', color: '#ca9c04', fontWeight: 600 }}>First user — becomes Admin</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e0e0ec', marginBottom: '4px' }}>Join a Workspace</h2>
                      <p style={{ fontSize: '13px', color: '#4a4a60', marginBottom: '20px', lineHeight: 1.6 }}>Ask your Admin for the Workspace ID. You'll join as a member — admin assigns your role.</p>
                    </>
                  )}

                  {error && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '16px', borderRadius: '8px', background: '#1a0808', border: '1px solid #2a1010', color: '#ef4444', fontSize: '12px' }}><AlertCircle size={13} /> {error}</div>}

                  <form onSubmit={handleSignupInitiate}>
                    {isCreate ? (
                      <FieldInput label="Organization Name" value={form.orgName} onChange={f('orgName')} placeholder="Your Agency Name" />
                    ) : (
                      <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Hash size={10} /> Workspace ID</span></label>
                        <input type="text" value={form.orgSlug} onChange={fSlug} required placeholder="your-agency-name" style={inputStyle} onFocus={e => e.target.style.borderColor = '#2d5fdf'} onBlur={e => e.target.style.borderColor = '#1c1c2c'} />
                        <p style={{ fontSize: '11px', color: '#2e2e44', marginTop: '4px' }}>Lowercase letters, numbers, hyphens. Ask your admin.</p>
                      </div>
                    )}

                    <FieldInput label="Your Full Name" value={form.fullName} onChange={f('fullName')} placeholder="John Doe" />
                    <FieldInput label="Email Address" type="email" value={form.email} onChange={f('email')} placeholder="name@agency.com" />
                    <FieldInput label="Set a Password" value={form.password} onChange={f('password')} placeholder="••••••••" showToggle onToggle={() => setShowPass(p => !p)} showPass={showPass} />

                    {!isCreate && (
                      <div style={{ background: '#0d0d1e', border: '1px solid #1c1c2c', borderRadius: '8px', padding: '11px 14px', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '13px' }}>ℹ️</span>
                        <p style={{ margin: 0, fontSize: '11px', color: '#4a4a60', lineHeight: 1.6 }}>
                          You'll join as <strong style={{ color: '#5a5a70' }}>Editor</strong> by default. Your Admin can change your role from the Team page.
                        </p>
                      </div>
                    )}

                    <button type="submit" disabled={loading}
                      style={{ width: '100%', padding: '13px', borderRadius: '8px', background: isCreate ? '#2d5fdf' : '#2d5fdf', color: 'white', fontSize: '14px', fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
                      {loading ? <Spinner text={signupButtonLoadLabel} /> : signupButtonLabel}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <footer style={{ position: 'relative', zIndex: 1, paddingBottom: '18px' }}>
        <p style={{ textAlign: 'center', fontSize: '10px', letterSpacing: '0.12em', color: '#18181e', textTransform: 'uppercase' }}>© 2024 Rookies HQ</p>
      </footer>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
