import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../api/client';
import {
  Bolt, Eye, EyeOff, AlertCircle, Building2, Mail,
  ArrowLeft, RotateCcw, Hash, Shield,
} from 'lucide-react';

const inputStyle = {
  width: '100%', padding: '12px 16px', background: '#3a3331',
  border: 'none', borderRadius: '9px', fontSize: '14px',
  color: '#ece0dc', outline: '2px solid transparent', boxSizing: 'border-box',
  fontFamily: 'inherit', transition: 'outline-color 150ms',
};
const labelStyle = {
  display: 'block', fontSize: '10px', fontWeight: 700,
  letterSpacing: '0.12em', color: 'rgba(88,66,55,0.6)', textTransform: 'uppercase', marginBottom: '8px',
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
          style={{ ...inputStyle, paddingRight: showToggle ? '44px' : '16px', outlineColor: focused ? 'rgba(249,115,22,0.4)' : 'transparent', background: focused ? '#3f3835' : '#3a3331' }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {showToggle && (
          <button type="button" onClick={onToggle} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(88,66,55,0.55)', cursor: 'pointer', padding: 0 }}>
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#120d0b', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 20% 50%, rgba(249,115,22,0.12) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(120,50,0,0.15) 0%, transparent 50%)', pointerEvents: 'none' }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, padding: '40px 20px' }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '36px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #ffb690, #f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', boxShadow: '0 0 40px rgba(249,115,22,0.35)' }}>
            <Bolt size={24} style={{ color: '#341100' }} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.25em', color: '#f5ede8', textTransform: 'uppercase', margin: 0 }}>Rookies HQ</h1>
          <p style={{ fontSize: '11px', letterSpacing: '0.25em', color: 'rgba(88,66,55,0.55)', textTransform: 'uppercase', marginTop: '5px', fontWeight: 500 }}>Creative Agency Workflow OS</p>
        </div>

        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Loading state */}
          {step === 'loading' && (
            <div style={{ textAlign: 'center', color: 'rgba(88,66,55,0.5)', fontSize: '13px', padding: '40px' }}>
              <span style={{ display: 'inline-block', width: '20px', height: '20px', border: '2px solid #2a2a40', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}

          {step !== 'loading' && (
            <div style={{ background: 'rgba(26, 18, 16, 0.55)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '32px', boxShadow: '0 20px 60px rgba(15,10,8,0.6), inset 0 1px 0 rgba(255,255,255,0.05)' }}>

              {/* ─── OTP STEP ────────────────────────────────── */}
              {step === 'otp' && (
                <>
                  <button onClick={() => { setStep('signup'); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'rgba(167,139,125,0.5)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '20px', padding: 0 }}>
                    <ArrowLeft size={13} /> Back
                  </button>
                  <div style={{ width: '44px', height: '44px', borderRadius: '11px', background: 'rgba(249,115,22,0.12)', outline: '1px solid rgba(249,115,22,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                    <Mail size={20} style={{ color: '#f97316' }} />
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ece0dc', marginBottom: '6px' }}>Check your email</h2>
                  <p style={{ fontSize: '13px', color: 'rgba(167,139,125,0.65)', marginBottom: '4px', lineHeight: 1.6 }}>
                    6-digit code sent to <strong style={{ color: '#e0c0b1' }}>{form.email}</strong>
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(88,66,55,0.5)', marginBottom: '20px' }}>
                    Workspace: <strong style={{ color: 'rgba(167,139,125,0.6)' }}>{pendingOrgName}</strong>
                  </p>

                  {error && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '16px', borderRadius: '9px', background: 'rgba(248,113,113,0.08)', outline: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontSize: '12px' }}><AlertCircle size={13} /> {error}</div>}

                  <form onSubmit={handleOtpVerify}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                      {otp.map((digit, i) => (
                        <input key={i} ref={el => otpRefs.current[i] = el}
                          type="text" inputMode="numeric" maxLength={1} value={digit}
                          onChange={e => handleOtpChange(i, e.target.value)}
                          onKeyDown={e => handleOtpKeyDown(i, e)}
                          onPaste={i === 0 ? handleOtpPaste : undefined}
                          style={{ width: '46px', height: '56px', textAlign: 'center', fontSize: '22px', fontWeight: 800, color: '#ece0dc', background: '#3a3331', border: 'none', outline: `2px solid ${digit ? '#f97316' : 'transparent'}`, borderRadius: '10px', caretColor: '#f97316', transition: 'outline-color 100ms', fontFamily: 'inherit' }}
                          onFocus={e => { e.target.style.outlineColor = 'rgba(249,115,22,0.5)'; e.target.style.background = '#3f3835'; }}
                          onBlur={e => { e.target.style.outlineColor = digit ? 'rgba(249,115,22,0.4)' : 'transparent'; e.target.style.background = '#3a3331'; }}
                        />
                      ))}
                    </div>
                    <button type="submit" disabled={loading || otp.join('').length < 6}
                      style={{ width: '100%', padding: '13px', borderRadius: '10px', background: 'linear-gradient(135deg, #ffb690, #f97316)', color: '#341100', fontSize: '14px', fontWeight: 700, border: 'none', cursor: (loading || otp.join('').length < 6) ? 'not-allowed' : 'pointer', opacity: (loading || otp.join('').length < 6) ? 0.4 : 1, marginBottom: '14px', boxShadow: '0 2px 16px rgba(249,115,22,0.3)' }}>
                      {loading ? <Spinner text="Verifying..." /> : (isCreate ? 'Verify & Create Workspace' : 'Verify & Join Workspace')}
                    </button>
                  </form>
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={handleResend} disabled={resendCooldown > 0}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', fontSize: '12px', fontWeight: 600, cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', color: resendCooldown > 0 ? 'rgba(88,66,55,0.4)' : '#f97316' }}>
                      <RotateCcw size={12} />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </button>
                  </div>
                </>
              )}

              {/* ─── LOGIN STEP ──────────────────────────────── */}
              {step === 'login' && (
                <>
                  <h2 style={{ fontSize: '19px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ece0dc', marginBottom: '4px' }}>Sign In</h2>
                  <p style={{ fontSize: '13px', color: 'rgba(167,139,125,0.6)', marginBottom: '24px' }}>Enter your credentials to access your workspace.</p>

                  {error && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '16px', borderRadius: '8px', background: '#1a0808', border: '1px solid #2a1010', color: '#ef4444', fontSize: '12px' }}><AlertCircle size={13} /> {error}</div>}

                  <form onSubmit={handleLogin}>
                    <FieldInput label="Email Address" type="email" value={form.email} onChange={f('email')} placeholder="name@agency.com" />
                    <FieldInput label="Password" value={form.password} onChange={f('password')} placeholder="••••••••" showToggle onToggle={() => setShowPass(p => !p)} showPass={showPass} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: '6px 0 20px' }}>
                      <input type="checkbox" style={{ width: '15px', height: '15px', accentColor: '#f97316' }} />
                      <span style={{ fontSize: '13px', color: 'rgba(167,139,125,0.55)' }}>Remember this session</span>
                    </label>
                    <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: '10px', background: 'linear-gradient(135deg, #ffb690, #f97316)', color: '#341100', fontSize: '14px', fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, boxShadow: '0 2px 20px rgba(249,115,22,0.35)', letterSpacing: '0.01em' }}>
                      {loading ? <Spinner text="Signing in..." /> : 'Sign In to Workspace'}
                    </button>
                  </form>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '18px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(88,66,55,0.2)' }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(88,66,55,0.4)', textTransform: 'uppercase' }}>
                      {isCreate ? 'First time here?' : 'New here?'}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(88,66,55,0.2)' }} />
                  </div>

                  <button onClick={() => { setStep('signup'); setError(''); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', borderRadius: '10px', background: 'rgba(249,115,22,0.08)', outline: '1px solid rgba(249,115,22,0.2)', fontSize: '14px', fontWeight: 600, color: 'rgba(255,182,144,0.8)', cursor: 'pointer', transition: 'all 150ms', border: 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.15)'; e.currentTarget.style.outlineColor = 'rgba(249,115,22,0.4)'; e.currentTarget.style.color = '#ffb690'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.08)'; e.currentTarget.style.outlineColor = 'rgba(249,115,22,0.2)'; e.currentTarget.style.color = 'rgba(255,182,144,0.8)'; }}>
                    {isCreate ? <><Shield size={15} /> Sign Up — Create Workspace</> : <><Building2 size={15} /> Sign Up — Join a Workspace</>}
                  </button>
                </>
              )}

              {/* ─── SIGNUP STEP ─────────────────────────────── */}
              {step === 'signup' && (
                <>
                  <button onClick={() => { setStep('login'); setError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'rgba(167,139,125,0.5)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '20px', padding: 0 }}>
                    <ArrowLeft size={13} /> Back to sign in
                  </button>

                  {/* Icon + heading changes based on mode */}
                  <div style={{ width: '44px', height: '44px', borderRadius: '11px', background: 'rgba(249,115,22,0.1)', outline: `1px solid ${isCreate ? 'rgba(251,191,36,0.3)' : 'rgba(249,115,22,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                    {isCreate ? <Shield size={20} style={{ color: '#fbbf24' }} /> : <Building2 size={20} style={{ color: '#f97316' }} />}
                  </div>

                  {isCreate ? (
                    <>
                      <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ece0dc', marginBottom: '4px' }}>Create Workspace</h2>
                      <p style={{ fontSize: '13px', color: 'rgba(167,139,125,0.6)', marginBottom: '6px', lineHeight: 1.6 }}>No workspace exists yet — you'll be the <strong style={{ color: '#fbbf24' }}>Admin</strong>.</p>
                      {/* Admin badge */}
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '9999px', background: 'rgba(251,191,36,0.1)', outline: '1px solid rgba(251,191,36,0.25)', marginBottom: '20px' }}>
                        <Shield size={11} style={{ color: '#fbbf24' }} />
                        <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 600 }}>First user — becomes Admin</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#ece0dc', marginBottom: '4px' }}>Join a Workspace</h2>
                      <p style={{ fontSize: '13px', color: 'rgba(167,139,125,0.6)', marginBottom: '20px', lineHeight: 1.6 }}>Ask your Admin for the Workspace ID. You'll join as a member — admin assigns your role.</p>
                    </>
                  )}

                  {error && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '16px', borderRadius: '8px', background: '#1a0808', border: '1px solid #2a1010', color: '#ef4444', fontSize: '12px' }}><AlertCircle size={13} /> {error}</div>}

                  <form onSubmit={handleSignupInitiate}>
                    {isCreate ? (
                      <FieldInput label="Organization Name" value={form.orgName} onChange={f('orgName')} placeholder="Your Agency Name" />
                    ) : (
                      <div style={{ marginBottom: '14px' }}>
                        <label style={labelStyle}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Hash size={10} /> Workspace ID</span></label>
                        <input type="text" value={form.orgSlug} onChange={fSlug} required placeholder="your-agency-name" style={inputStyle} onFocus={e => { e.target.style.outlineColor = 'rgba(249,115,22,0.4)'; e.target.style.background = '#3f3835'; }} onBlur={e => { e.target.style.outlineColor = 'transparent'; e.target.style.background = '#3a3331'; }} />
                        <p style={{ fontSize: '11px', color: 'rgba(88,66,55,0.4)', marginTop: '4px' }}>Lowercase letters, numbers, hyphens. Ask your admin.</p>
                      </div>
                    )}

                    <FieldInput label="Your Full Name" value={form.fullName} onChange={f('fullName')} placeholder="John Doe" />
                    <FieldInput label="Email Address" type="email" value={form.email} onChange={f('email')} placeholder="name@agency.com" />
                    <FieldInput label="Set a Password" value={form.password} onChange={f('password')} placeholder="••••••••" showToggle onToggle={() => setShowPass(p => !p)} showPass={showPass} />

                    {!isCreate && (
                      <div style={{ background: 'rgba(249,115,22,0.06)', outline: '1px solid rgba(249,115,22,0.15)', borderRadius: '9px', padding: '11px 14px', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '13px' }}>ℹ️</span>
                        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(167,139,125,0.55)', lineHeight: 1.6 }}>
                          You'll join as <strong style={{ color: '#e0c0b1' }}>Editor</strong> by default. Your Admin can change your role from the Team page.
                        </p>
                      </div>
                    )}

                    <button type="submit" disabled={loading}
                      style={{ width: '100%', padding: '13px', borderRadius: '10px', background: 'linear-gradient(135deg, #ffb690, #f97316)', color: '#341100', fontSize: '14px', fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.4 : 1, boxShadow: '0 2px 20px rgba(249,115,22,0.35)', letterSpacing: '0.01em' }}>
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
        <p style={{ textAlign: 'center', fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(88,66,55,0.3)', textTransform: 'uppercase' }}>© 2025 Rookies HQ</p>
      </footer>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
