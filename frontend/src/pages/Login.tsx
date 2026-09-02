import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CREDENTIALS = [
  { role: 'Admin',       email: 'admin@company.com',       pass: 'admin123'       },
  { role: 'Manager',     email: 'manager@company.com',     pass: 'manager123'     },
  { role: 'HR',          email: 'hr@company.com',          pass: 'hr123'          },
  { role: 'Interviewer', email: 'interviewer@company.com', pass: 'interviewer123' },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setMounted(true);
    // Animated dot grid on canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let frame = 0;
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const spacing = 36;
      const cols = Math.ceil(canvas.width / spacing) + 1;
      const rows = Math.ceil(canvas.height / spacing) + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * spacing;
          const y = r * spacing;
          const wave = Math.sin((c + r) * 0.4 + frame * 0.012) * 0.5 + 0.5;
          const alpha = wave * 0.09 + 0.02;
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(201, 168, 76, ${alpha})`;
          ctx.fill();
        }
      }
      frame++;
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    if (user) {
      if (from) { navigate(from, { replace: true }); return; }
      const routes: Record<string, string> = {
        ADMIN: '/admin', MANAGER: '/manager', HR: '/hr',
        INTERVIEWER: '/interviewer', CANDIDATE: '/candidate',
      };
      navigate(routes[user.role] || '/', { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (cred: typeof CREDENTIALS[0]) => {
    setEmail(cred.email);
    setPassword(cred.pass);
    setError('');
  };

  return (
    <div style={{ fontFamily: 'var(--font-body)', background: 'var(--obsidian)', minHeight: '100vh', display: 'flex' }}>

      {/* ── LEFT PANEL: Brand ─────────────────────────────── */}
      <div style={{
        width: '48%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px',
        background: 'var(--obsidian-2)',
        overflow: 'hidden',
      }}>
        {/* Dot-grid canvas */}
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />

        {/* Gradient overlays for depth */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 20% 80%, rgba(201,168,76,0.07) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 90% 10%, rgba(30,58,95,0.5) 0%, transparent 60%)', pointerEvents: 'none' }} />

        {/* Geometric accent lines */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', opacity: 0.3 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', opacity: 0.15 }} />

        {/* Logo mark */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px',
              border: '1px solid rgba(201,168,76,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: '8px', height: '8px', borderTop: '2px solid var(--gold)', borderLeft: '2px solid var(--gold)' }} />
              <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '8px', height: '8px', borderBottom: '2px solid var(--gold)', borderRight: '2px solid var(--gold)' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.05em' }}>HR</span>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'rgba(240,244,248,0.9)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Portal
            </span>
          </div>
        </div>

        {/* Center content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Large decorative number/stat */}
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(80px, 12vw, 140px)',
            fontWeight: 800,
            lineHeight: 1,
            color: 'transparent',
            WebkitTextStroke: '1px rgba(201,168,76,0.15)',
            marginBottom: '32px',
            userSelect: 'none',
          }}>
            HR
          </div>

          <div style={{ width: '40px', height: '2px', background: 'var(--gold)', marginBottom: '24px', opacity: 0.8 }} />

          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            margin: '0 0 16px',
            letterSpacing: '-0.02em',
          }}>
            Streamline your<br />entire hiring process
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, maxWidth: '320px' }}>
            From requisition to offer — manage positions, candidates, assessments, and interviews in one unified workspace.
          </p>
        </div>

        {/* Bottom feature pills */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['Secure Assessments', 'Live Proctoring', 'Pipeline Tracking'].map(f => (
            <span key={f} style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              padding: '5px 12px',
              letterSpacing: '0.04em',
            }}>
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL: Form ─────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        background: 'var(--obsidian)',
        position: 'relative',
      }}>
        {/* Subtle right-side glow */}
        <div style={{ position: 'absolute', top: '30%', right: 0, width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(30,58,95,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{
          width: '100%',
          maxWidth: '380px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1)',
        }}>
          {/* Form header */}
          <div style={{ marginBottom: '40px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 10px' }}>
              Secure Access
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '30px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Sign in
            </h1>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Error */}
            {error && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                fontSize: '13px',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: 'fadeIn 0.2s ease',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            {/* Email field */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  required
                  placeholder="you@company.com"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: 'var(--obsidian-3)',
                    border: `1px solid ${focused === 'email' ? 'rgba(201,168,76,0.5)' : 'var(--border-mid)'}`,
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'var(--font-body)',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    boxShadow: focused === 'email' ? '0 0 0 3px rgba(201,168,76,0.08), inset 0 1px 2px rgba(0,0,0,0.3)' : 'inset 0 1px 2px rgba(0,0,0,0.3)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'var(--obsidian-3)',
                  border: `1px solid ${focused === 'password' ? 'rgba(201,168,76,0.5)' : 'var(--border-mid)'}`,
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-body)',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxShadow: focused === 'password' ? '0 0 0 3px rgba(201,168,76,0.08), inset 0 1px 2px rgba(0,0,0,0.3)' : 'inset 0 1px 2px rgba(0,0,0,0.3)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px',
                background: loading ? 'rgba(201,168,76,0.4)' : 'var(--gold)',
                color: '#0a0f1a',
                fontSize: '13px',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'var(--gold-light)'; }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'var(--gold)'; }}
            >
              {loading ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '28px 0 20px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Demo Access</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>

          {/* Quick-fill credentials */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {CREDENTIALS.map(cred => (
              <button
                key={cred.role}
                onClick={() => quickFill(cred)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--obsidian-3)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease, background 0.15s ease',
                  textAlign: 'left',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = 'rgba(201,168,76,0.25)';
                  el.style.background = 'var(--obsidian-4)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = 'var(--border-subtle)';
                  el.style.background = 'var(--obsidian-3)';
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{cred.role}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{cred.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder { color: var(--text-dim); }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px var(--obsidian-3) inset !important;
          -webkit-text-fill-color: var(--text-primary) !important;
        }
      `}</style>
    </div>
  );
}
