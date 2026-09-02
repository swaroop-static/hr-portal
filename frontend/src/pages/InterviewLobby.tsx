import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoundForInterview } from '../api';

interface RoundInfo {
  id: string;
  type: string;
  application?: {
    candidate?: { name: string };
    position?: { title: string };
  };
}

interface CheckItem {
  id: string;
  label: string;
  status: 'pending' | 'ok' | 'error';
}

export default function InterviewLobby() {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null);
  const [roundLoading, setRoundLoading] = useState(true);
  const [roundError, setRoundError] = useState<string | null>(null);

  const [micLevel, setMicLevel] = useState(0);
  const [checks, setChecks] = useState<CheckItem[]>([
    { id: 'camera', label: 'Camera', status: 'pending' },
    { id: 'microphone', label: 'Microphone', status: 'pending' },
    { id: 'browser', label: 'Browser Compatible', status: 'pending' },
  ]);

  const updateCheck = useCallback((id: string, status: CheckItem['status']) => {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  }, []);

  // Browser compatibility check
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      !!window.RTCPeerConnection &&
      !!window.AudioContext;
    updateCheck('browser', supported ? 'ok' : 'error');
  }, [updateCheck]);

  // Media stream setup
  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        updateCheck('camera', 'ok');
        updateCheck('microphone', 'ok');

        // AudioContext for mic level meter
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        src.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        function poll() {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          const pct = Math.min(100, (avg / 128) * 100);
          setMicLevel(pct);
          animFrameRef.current = requestAnimationFrame(poll);
        }
        poll();
      } catch {
        updateCheck('camera', 'error');
        updateCheck('microphone', 'error');
      }
    }

    setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
        analyserRef.current = null;
      }
    };
  }, [updateCheck]);

  // Fetch round info
  useEffect(() => {
    if (!roundId) return;
    setRoundLoading(true);
    getRoundForInterview(roundId)
      .then(data => { setRoundInfo(data); setRoundError(null); })
      .catch(err => setRoundError(err?.response?.data?.error || 'Failed to load round info.'))
      .finally(() => setRoundLoading(false));
  }, [roundId]);

  function handleJoin() {
    // Stop tracks — InterviewRoom will re-acquire them
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    navigate(`/interview/${roundId}`);
  }

  const allOk = checks.every(c => c.status === 'ok');
  const hasError = checks.some(c => c.status === 'error');

  const roundTypeLabel: Record<string, string> = {
    TECHNICAL_INTERVIEW: 'Technical Interview',
    HR_INTERVIEW: 'HR Interview',
    FINAL_INTERVIEW: 'Final Interview',
    TEST: 'Assessment',
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--obsidian,#0f1117)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-body,system-ui)', padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '860px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '36px', height: '36px', border: '1px solid rgba(201,168,76,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: '6px', height: '6px', borderTop: '1.5px solid var(--gold,#C9A84C)', borderLeft: '1.5px solid var(--gold,#C9A84C)' }} />
              <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '6px', height: '6px', borderBottom: '1.5px solid var(--gold,#C9A84C)', borderRight: '1.5px solid var(--gold,#C9A84C)' }} />
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold,#C9A84C)" strokeWidth="1.75" style={{ width: 16, height: 16 }}>
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display,monospace)', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary,#e2e8f0)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Interview Lobby</span>
          </div>

          {roundLoading ? (
            <p style={{ color: 'var(--text-dim,#64748b)', fontSize: '13px' }}>Loading session info...</p>
          ) : roundError ? (
            <p style={{ color: '#f87171', fontSize: '13px' }}>{roundError}</p>
          ) : roundInfo ? (
            <div>
              <p style={{ margin: '0 0 4px', color: 'var(--text-secondary,#94a3b8)', fontSize: '14px' }}>
                {roundTypeLabel[roundInfo.type] || roundInfo.type}
                {roundInfo.application?.position?.title ? ` — ${roundInfo.application.position.title}` : ''}
              </p>
              <p style={{ margin: 0, color: 'var(--text-dim,#64748b)', fontSize: '12px' }}>
                Welcome, <span style={{ color: 'var(--gold,#C9A84C)', fontWeight: 600 }}>{user?.name}</span>
              </p>
            </div>
          ) : null}
        </div>

        {/* Main layout: video + checks */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Video preview */}
          <div style={{ background: 'var(--obsidian-2,#161b22)', border: '1px solid var(--border-subtle,rgba(255,255,255,0.08))', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }}
              />
              {/* Name label */}
              <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.65)', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', color: '#fff', fontWeight: 500, backdropFilter: 'blur(4px)' }}>
                {user?.name} (You)
              </div>
            </div>

            {/* Mic level meter */}
            <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-dim,#64748b)" strokeWidth="1.75" style={{ width: 15, height: 15, flexShrink: 0 }}>
                  <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${micLevel}%`, height: '100%', borderRadius: '4px',
                    background: micLevel > 60 ? '#4ADE80' : micLevel > 20 ? 'var(--gold,#C9A84C)' : '#60A5FA',
                    transition: 'width 0.05s ease, background 0.3s ease',
                  }} />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-dim,#64748b)', width: '32px', textAlign: 'right' }}>{Math.round(micLevel)}%</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-dim,#64748b)' }}>Microphone level — speak to test</p>
            </div>
          </div>

          {/* Checks + join button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Pre-check list */}
            <div style={{ background: 'var(--obsidian-2,#161b22)', border: '1px solid var(--border-subtle,rgba(255,255,255,0.08))', borderRadius: '12px', padding: '20px 22px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-dim,#64748b)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tech Checks</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {checks.map(check => {
                  const statusIcon = check.status === 'ok'
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" style={{ width: 16, height: 16 }}><polyline points="20 6 9 17 4 12"/></svg>
                    : check.status === 'error'
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" style={{ width: 16, height: 16 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    : (
                      <div style={{ width: 16, height: 16, border: '2px solid var(--text-dim,#64748b)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                    );

                  return (
                    <div key={check.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: check.status === 'ok' ? 'rgba(74,222,128,0.12)' : check.status === 'error' ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {statusIcon}
                      </div>
                      <span style={{ fontSize: '13px', color: check.status === 'ok' ? 'var(--text-primary,#e2e8f0)' : check.status === 'error' ? '#f87171' : 'var(--text-secondary,#94a3b8)', fontWeight: check.status === 'ok' ? 600 : 400 }}>
                        {check.label}
                      </span>
                      {check.status === 'ok' && (
                        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4ADE80', fontWeight: 600 }}>Ready</span>
                      )}
                      {check.status === 'error' && (
                        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#f87171', fontWeight: 600 }}>Failed</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>

            {/* Info card */}
            <div style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '10px', padding: '14px 16px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#93c5fd', lineHeight: 1.6 }}>
                <strong style={{ color: '#60A5FA' }}>Before you join:</strong> make sure you are in a quiet place with good lighting. Your camera and microphone will be shared with the other participant.
              </p>
            </div>

            {hasError && (
              <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '10px', padding: '14px 16px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#fca5a5', lineHeight: 1.6 }}>
                  Some checks failed. Please allow camera and microphone access in your browser settings and reload the page.
                </p>
              </div>
            )}

            {/* Join button */}
            <button
              onClick={handleJoin}
              disabled={!allOk}
              style={{
                width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
                background: allOk ? 'var(--gold,#C9A84C)' : 'rgba(255,255,255,0.08)',
                color: allOk ? '#0f1117' : 'var(--text-dim,#64748b)',
                fontSize: '15px', fontWeight: 700, cursor: allOk ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-body,system-ui)', transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                opacity: allOk ? 1 : 0.5,
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              {allOk ? 'Join Interview' : 'Waiting for checks…'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
