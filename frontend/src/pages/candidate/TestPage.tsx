import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import * as faceapi from 'face-api.js';
import {
  getAttemptByToken, startAttempt, submitAttempt, reportTabSwitch, terminateAttempt, loginUser
} from '../../api';

type Screen = 'loading' | 'error' | 'login' | 'welcome' | 'test' | 'submitted' | 'terminated' | 'expired';

export default function TestPage() {
  const { token } = useParams<{ token: string }>();
  const [screen, setScreen] = useState<Screen>('loading');
  const [attempt, setAttempt] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [requiresManualGrading, setRequiresManualGrading] = useState(false);
  const [tabAlertCount, setTabAlertCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [isReconnect, setIsReconnect] = useState(false);
  const [proctorReady, setProctorReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const screenshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceDetectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const terminatedRef = useRef(false);
  const anticheatActiveRef = useRef(false);
  const faceModelLoadedRef = useRef(false);
  const faceWarnRef = useRef(0);

  const loadAttempt = async () => {
    setScreen('loading');
    setIsReconnect(false);
    try {
      const data = await getAttemptByToken(token!);
      if (data.status === 'SUBMITTED') return setScreen('submitted');
      if (data.status === 'TERMINATED') return setScreen('terminated');
      if (!data?.round?.test?.questions || data.round.test.questions.length === 0) {
        setError('Test data is incomplete. Please contact HR.');
        return;
      }
      setAttempt(data);
      setQuestions(data.round.test.questions);

      if (data.status === 'IN_PROGRESS' && data.startedAt) {
        // Reconnect: calculate remaining time so the timer resumes correctly
        const elapsed = Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000);
        const total = (data.round?.test?.duration || 30) * 60;
        setTimeLeft(Math.max(10, total - elapsed));
        setIsReconnect(true);
      } else {
        setTimeLeft((data.round?.test?.duration || 30) * 60);
      }

      setScreen('welcome');
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        setScreen('login');
      } else {
        setScreen('error');
      }
    }
  };

  // Load attempt — show login first if not authenticated
  useEffect(() => {
    const storedToken = localStorage.getItem('hr_portal_token');
    if (!storedToken) {
      setScreen('login');
    } else {
      loadAttempt();
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const result = await loginUser(loginEmail, loginPassword);
      localStorage.setItem('hr_portal_token', result.token);
      localStorage.setItem('hr_portal_user', JSON.stringify(result.user));
      await loadAttempt();
    } catch (e: any) {
      setLoginError(e?.response?.data?.error || 'Login failed. Check your credentials.');
    }
    setLoginLoading(false);
  };

  // Load face detection model asynchronously on mount
  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri('/models')
      .then(() => { faceModelLoadedRef.current = true; }).catch(() => {});
  }, []);

  // Connect socket on welcome screen to receive proctor-joined signal
  useEffect(() => {
    if (screen !== 'welcome' || !attempt) return;
    if (isReconnect) { setProctorReady(true); return; }

    const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      auth: { token: localStorage.getItem('hr_portal_token') },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-candidate-room', { attemptId: attempt.id });
    });
    socket.on('proctor-joined', () => setProctorReady(true));
  }, [screen, attempt?.id, isReconnect]);

  const doCleanup = useCallback(() => {
    timerRef.current && clearInterval(timerRef.current);
    screenshotIntervalRef.current && clearInterval(screenshotIntervalRef.current);
    faceDetectIntervalRef.current && clearInterval(faceDetectIntervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // Hard terminate — calls backend, marks DB as TERMINATED so refresh can't restart
  const hardTerminate = useCallback(async () => {
    if (terminatedRef.current) return;
    terminatedRef.current = true;
    doCleanup();
    try { await terminateAttempt(token!); } catch {}
    setScreen('terminated');
  }, [token, doCleanup]);

  // Tab switch / fullscreen exit: 1st = warning, 2nd = terminate via backend
  const handleTabViolation = useCallback(async () => {
    if (!anticheatActiveRef.current || terminatedRef.current) return;
    try {
      const result = await reportTabSwitch(token!);
      if (result.terminated) {
        terminatedRef.current = true;
        doCleanup();
        setScreen('terminated');
      } else {
        setWarningMsg('⚠️ Warning: Tab switching detected! One more violation will permanently terminate your test.');
        setTimeout(() => setWarningMsg(null), 6000);
      }
    } catch {}
  }, [token, doCleanup]);

  // Face out-of-frame: 1st = warning, 2nd = hard terminate
  const handleFaceViolation = useCallback(async () => {
    if (!anticheatActiveRef.current || terminatedRef.current) return;
    faceWarnRef.current += 1;
    if (faceWarnRef.current === 1) {
      setWarningMsg('⚠️ Warning: Keep your face visible in the camera! One more violation will terminate your test.');
      setTimeout(() => setWarningMsg(null), 6000);
    } else {
      await hardTerminate();
    }
  }, [hardTerminate]);

  const handleSubmit = useCallback(async () => {
    if (terminatedRef.current) return;
    terminatedRef.current = true;
    doCleanup();
    try {
      const result = await submitAttempt(token!, responses);
      setScore(result.score);
      setRequiresManualGrading(result.requiresManualGrading || false);
      setScreen('submitted');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to submit test. Please contact HR immediately.');
      terminatedRef.current = false; // allow retry
    }
  }, [token, responses, doCleanup]);

  const startTest = async () => {
    // Request fullscreen
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen not supported — continue anyway
      console.warn('Fullscreen request failed');
    }

    // Start webcam
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (e: any) {
      const name = e?.name || '';
      const msg = name === 'NotReadableError' || name === 'TrackStartError'
        ? 'Camera is already in use by another application (Zoom, Teams, etc.). Close those apps and try again.'
        : name === 'NotFoundError' || name === 'DevicesNotFoundError'
        ? 'No camera found on this device. Please connect a webcam and try again.'
        : name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Camera access was denied. Click the camera icon in your browser address bar and select "Allow", then try again.'
        : name === 'OverconstrainedError'
        ? 'Camera does not meet requirements. Try again or contact HR.'
        : `Camera error (${name || 'unknown'}): ${e?.message || 'Could not access camera.'}`;
      setCameraError(msg);
      return;
    }

    // Setup socket + screenshot relay for proctoring (non-fatal if it fails)
    try {
      const attemptId = attempt.id;

      // Reuse socket from welcome screen if already connected, else create new
      let socket = socketRef.current;
      if (!socket || !socket.connected) {
        socket?.disconnect();
        socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
          auth: { token: localStorage.getItem('hr_portal_token') },
        });
        socketRef.current = socket;
        socket.on('connect', () => {
          socket!.emit('join-candidate-room', { attemptId });
        });
      }

      socket.on('test-terminated', () => {
        terminatedRef.current = true;
        streamRef.current?.getTracks().forEach(t => t.stop());
        setScreen('terminated');
      });

      // Capture webcam frame every 100ms and send to proctor via Socket.io
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      screenshotIntervalRef.current = setInterval(() => {
        if (terminatedRef.current || !ctx || !videoRef.current) return;
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        const image = canvas.toDataURL('image/jpeg', 0.4);
        socket.emit('candidate-screenshot', { attemptId, image });
      }, 100);

      // Face detection — check every 2s once model is loaded
      faceDetectIntervalRef.current = setInterval(async () => {
        if (terminatedRef.current || !videoRef.current || !faceModelLoadedRef.current) return;
        try {
          const result = await faceapi.detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })
          );
          if (!result) handleFaceViolation();
        } catch {}
      }, 2000);
    } catch (e: any) {
      console.error('Proctoring setup failed:', e);
    }

    // Call start API (skip if reconnecting — attempt is already IN_PROGRESS)
    if (!isReconnect) {
      try {
        await startAttempt(token!);
      } catch (e: any) {
        setCameraError(e?.response?.data?.error || 'Failed to start test. Please contact HR.');
        return;
      }
    }
    setScreen('test');

    // Start timer
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  // Attach webcam stream to video element once test screen mounts
  useEffect(() => {
    if (screen === 'test' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [screen]);

  // Anti-cheat: tab switch / visibility change
  useEffect(() => {
    if (screen !== 'test') return;

    // 2-second grace period — prevents false positives from fullscreen transition on test start
    const graceTimer = setTimeout(() => { anticheatActiveRef.current = true; }, 2000);

    const handleVisibility = () => {
      if (document.hidden) handleTabViolation();
    };
    const handleFullscreen = () => {
      if (!document.fullscreenElement && !terminatedRef.current) handleTabViolation();
    };
    const blockContextMenu = (e: Event) => e.preventDefault();
    const blockCopy = (e: Event) => e.preventDefault();
    const blockCut = (e: Event) => e.preventDefault();

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('copy', blockCopy);
    document.addEventListener('cut', blockCut);

    return () => {
      clearTimeout(graceTimer);
      anticheatActiveRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('cut', blockCut);
    };
  }, [screen, handleTabViolation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      doCleanup();
      socketRef.current?.disconnect();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [doCleanup]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const q = questions[currentQ];
  const answered = Object.keys(responses).length;

  // ========================
  // SCREENS
  // ========================

  if (error) return (
    <div style={{ color: 'red', padding: '2rem' }}>{error}</div>
  );

  if (screen === 'loading') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading your test...</p>
      </div>
    </div>
  );

  if (screen === 'error') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center bg-white rounded-2xl shadow-lg p-10 max-w-md">
        <div className="text-5xl mb-4">❌</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Test Link</h1>
        <p className="text-gray-500">This test link is invalid or has expired.</p>
      </div>
    </div>
  );

  if (screen === 'expired') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center bg-white rounded-2xl shadow-lg p-10 max-w-md">
        <div className="text-5xl mb-4">⏰</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Test Link Expired</h1>
        <p className="text-gray-500">This test has already been completed or expired.</p>
      </div>
    </div>
  );

  if (screen === 'submitted') return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
      <div className="text-center bg-white rounded-2xl shadow-xl p-12 max-w-md mx-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">✅</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Test Submitted!</h1>
        <p className="text-gray-500 mb-4">Your responses have been recorded and submitted successfully.</p>
        {score !== null && (
          <div className="bg-gray-50 rounded-xl p-4 mt-4">
            <p className="text-sm text-gray-500">Your Score</p>
            <p className="text-4xl font-bold text-gray-900 mt-1">{score}%</p>
          </div>
        )}
        {requiresManualGrading && (
          <p className="text-yellow-400 text-sm mt-2">
            This test includes written questions that require manual review. Your final result will be communicated by HR.
          </p>
        )}
        <p className="text-gray-400 text-sm mt-6">You may close this tab now.</p>
      </div>
    </div>
  );

  if (screen === 'terminated') return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
      <div className="text-center bg-white rounded-2xl shadow-xl p-12 max-w-md mx-4">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🚫</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Test Terminated</h1>
        <p className="text-gray-500">Your test has been automatically terminated due to suspicious activity.</p>
        <div className="bg-red-50 rounded-xl p-4 mt-6 text-left">
          <p className="text-red-700 text-sm font-medium mb-2">Reason:</p>
          <p className="text-red-600 text-sm">• Tab switching or window focus loss detected</p>
          <p className="text-red-600 text-sm">• Exiting fullscreen mode</p>
        </div>
        <p className="text-gray-400 text-sm mt-6">Please contact HR for further assistance.</p>
      </div>
    </div>
  );

  if (screen === 'login') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-8 py-8 text-center" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a9e 100%)' }}>
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="text-xl font-bold text-white">Candidate Login</h1>
          <p className="text-blue-200 text-sm mt-2">Sign in to access your assigned test</p>
        </div>
        <form onSubmit={handleLogin} className="px-8 py-6 space-y-4">
          {loginError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{loginError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
              required placeholder="your@email.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
              required placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <button type="submit" disabled={loginLoading}
            className="w-full py-3 text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a9e 100%)' }}>
            {loginLoading ? 'Signing in...' : 'Sign In →'}
          </button>
          <p className="text-center text-gray-400 text-xs">Use the email and password provided by HR</p>
        </form>
      </div>
    </div>
  );

  if (screen === 'welcome') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="px-8 py-8 text-center" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a9e 100%)' }}>
          <div className="text-4xl mb-3">📝</div>
          <h1 className="text-xl font-bold text-white">{attempt?.round?.test?.title}</h1>
          <p className="text-blue-200 text-sm mt-2">Welcome, {attempt?.candidateName}</p>
        </div>

        <div className="px-8 py-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
              <p className="text-xs text-gray-400 mt-1">Questions</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{attempt?.round?.test?.duration} min</p>
              <p className="text-xs text-gray-400 mt-1">Duration</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-amber-800 font-semibold text-sm mb-2">⚠️ Important Rules</p>
            <ul className="text-amber-700 text-xs space-y-1">
              <li>• <strong>Do NOT switch tabs</strong> — your test will be immediately terminated</li>
              <li>• <strong>Do NOT exit fullscreen</strong> — your test will be terminated</li>
              <li>• <strong>Webcam is required</strong> — you will be live proctored</li>
              <li>• <strong>No going back</strong> — once you start, there are no restarts</li>
              <li>• Your camera must be on throughout the entire test</li>
            </ul>
          </div>

          {isReconnect && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-blue-700 text-sm font-semibold mb-1">🔄 Reconnecting to your test</p>
              <p className="text-blue-600 text-xs">Your answers and remaining time have been preserved. Click below to re-enable your camera and resume.</p>
            </div>
          )}

          {cameraError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-700 text-sm font-semibold mb-1">Camera Error</p>
              <p className="text-red-600 text-xs">{cameraError}</p>
              <p className="text-red-500 text-xs mt-2">After allowing camera access in your browser, click the button below to try again.</p>
            </div>
          )}

          {!proctorReady && !isReconnect ? (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-gray-700 font-semibold text-sm">Waiting for proctor to join...</span>
              </div>
              <p className="text-gray-400 text-xs">Your test will unlock as soon as the proctor connects. Please keep this page open.</p>
            </div>
          ) : (
            <>
              <button onClick={() => { setCameraError(null); startTest(); }}
                className="w-full py-4 text-white font-bold text-lg rounded-xl shadow-lg hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a9e 100%)' }}>
                {cameraError ? 'Try Again →' : isReconnect ? 'Reconnect & Resume →' : 'Start Test →'}
              </button>
              <p className="text-center text-gray-400 text-xs mt-3">
                {isReconnect ? 'Your session will resume exactly where you left off' : 'Clicking Start will enable fullscreen and your camera'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ========================
  // TEST SCREEN
  // ========================
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col select-none" style={{ userSelect: 'none' }}>
      {/* Violation warning banner */}
      {warningMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-yellow-900 font-bold px-6 py-3 rounded-2xl shadow-2xl text-sm max-w-xl text-center border-2 border-yellow-600 animate-pulse">
          {warningMsg}
        </div>
      )}
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="text-sm font-semibold text-gray-700">{attempt?.round?.test?.title}</div>
          <div className="text-xs text-gray-400">{attempt?.candidateName}</div>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="text-sm text-gray-500">
            {answered}/{questions.length} answered
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-lg ${
            timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'
          }`}>
            ⏱ {formatTime(timeLeft)}
          </div>

          {/* Camera indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-lg">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-red-600">Live</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Question sidebar */}
        <div className="w-56 bg-white border-r border-gray-200 overflow-y-auto p-4 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Questions</p>
          <div className="grid grid-cols-4 gap-1.5">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrentQ(i)}
                className={`w-full aspect-square rounded-lg text-xs font-bold transition-all ${
                  i === currentQ ? 'text-white shadow-md' :
                  responses[questions[i]?.id] ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={i === currentQ ? { background: '#1e3a5f' } : {}}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Main question area */}
        <div className="flex-1 overflow-y-auto p-8">
          {q && (
            <div className="max-w-2xl mx-auto">
              {/* Question header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ background: '#1e3a5f' }}>
                  {currentQ + 1}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                    Question {currentQ + 1} of {questions.length} · {q.type === 'MCQ' ? 'Multiple Choice' : 'Text Answer'}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 leading-relaxed">{q.text}</h2>
                </div>
              </div>

              {/* MCQ options */}
              {q.type === 'MCQ' && (
                <div className="space-y-3">
                  {(() => { try { return JSON.parse(q.options || '[]'); } catch { return []; } })().map((opt: string, oi: number) => {
                    const selected = responses[q.id] === String(oi);
                    return (
                      <button
                        key={oi}
                        onClick={() => setResponses(r => ({ ...r, [q.id]: String(oi) }))}
                        className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all font-medium text-sm ${
                          selected
                            ? 'border-blue-500 bg-blue-50 text-blue-800'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50'
                        }`}
                        style={selected ? { borderColor: '#1e3a5f', backgroundColor: '#e8edf4' } : {}}>
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            selected ? 'border-blue-600' : 'border-gray-300'
                          }`} style={selected ? { borderColor: '#1e3a5f' } : {}}>
                            {selected && <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#1e3a5f' }} />}
                          </div>
                          <span>{opt}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Text answer */}
              {q.type === 'TEXT' && (
                <textarea
                  value={responses[q.id] || ''}
                  onChange={e => setResponses(r => ({ ...r, [q.id]: e.target.value }))}
                  rows={8}
                  placeholder="Type your answer here..."
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 resize-none bg-white"
                />
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8">
                <button
                  onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
                  disabled={currentQ === 0}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  ← Previous
                </button>

                {currentQ === questions.length - 1 ? (
                  <button
                    onClick={() => {
                      if (confirm(`Submit test? You've answered ${answered} of ${questions.length} questions.`)) {
                        handleSubmit();
                      }
                    }}
                    className="px-8 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg hover:opacity-90 transition-all"
                    style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5a9e)' }}>
                    Submit Test ✓
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentQ(q => Math.min(questions.length - 1, q + 1))}
                    className="px-5 py-2.5 text-sm font-medium text-white rounded-xl hover:opacity-90 transition-all"
                    style={{ background: '#1e3a5f' }}>
                    Next →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden webcam preview */}
      <video ref={videoRef} autoPlay playsInline muted className="fixed bottom-4 right-4 w-32 h-24 rounded-xl shadow-lg border-2 border-white object-cover z-30" />
    </div>
  );
}
