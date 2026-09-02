import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { getAttemptById, terminateAttempt } from '../../api';

export default function ProctoringView() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const socketRef = useRef<Socket | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [status, setStatus] = useState('Waiting for candidate...');
  const [terminated, setTerminated] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [attemptToken, setAttemptToken] = useState<string | null>(null);
  const [attemptInfo, setAttemptInfo] = useState<any>(null);
  const [terminating, setTerminating] = useState(false);

  // Fetch attempt details to get the token for termination
  useEffect(() => {
    if (!attemptId) return;
    getAttemptById(attemptId)
      .then(data => {
        setAttemptToken(data.token);
        setAttemptInfo(data);
        if (['SUBMITTED', 'TERMINATED'].includes(data.status)) {
          setTerminated(true);
          setStatus(data.status === 'SUBMITTED' ? 'Test submitted' : 'Test terminated');
        }
        setTabSwitches(data.tabSwitches || 0);
      })
      .catch((e: any) => setSocketError(e?.response?.data?.error || e?.message || 'Could not load attempt details.'));
  }, [attemptId]);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      auth: { token: localStorage.getItem('hr_portal_token') },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-proctor-room', { attemptId });
    });
    socket.on('reconnect', () => {
      socket.emit('join-proctor-room', { attemptId });
    });

    socket.on('connect_error', () => {
      setSocketError('Could not connect to proctoring server. Please refresh.');
    });

    socket.on('candidate-screenshot', ({ image }: { image: string }) => {
      setScreenshot(image);
      if (!connected) {
        setConnected(true);
        setStatus('Connected — watching live');
      }
    });

    socket.on('tab-switch-alert', ({ tabSwitches: ts }) => {
      setTabSwitches(ts);
      setStatus(`Tab switch detected (${ts} total)`);
    });

    socket.on('test-terminated', () => {
      setTerminated(true);
      setStatus('Test terminated');
      setConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [attemptId]);

  const handleTerminate = async () => {
    if (!attemptToken) return;
    if (!confirm('Are you sure you want to terminate this test? This cannot be undone.')) return;
    setTerminating(true);
    try {
      await terminateAttempt(attemptToken);
      setTerminated(true);
      setStatus('Test terminated by proctor');
      setConnected(false);
    } catch (e: any) {
      setSocketError(e?.response?.data?.error || 'Failed to terminate test.');
    }
    setTerminating(false);
  };

  return (
    <div className="p-8">
      {socketError && (
        <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-4 text-sm">
          {socketError}
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/hr/applications" className="text-sm text-gray-400 hover:text-blue-600">← Back</Link>
        <h1 className="text-2xl font-bold text-gray-900">Live Proctoring</h1>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${connected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {connected ? '🔴 Live' : '⏳ Waiting'}
        </span>
      </div>

      {attemptInfo && (
        <div className="bg-white border border-gray-100 rounded-2xl px-5 py-3 mb-5 text-sm text-gray-600 flex flex-wrap gap-4">
          <span><strong>{attemptInfo.candidateName}</strong> · {attemptInfo.candidateEmail}</span>
          {attemptInfo.round?.test && <span>Test: {attemptInfo.round.test.title} ({attemptInfo.round.test.duration} min)</span>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Video / Screenshot */}
        <div className="col-span-2">
          <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center relative">
            {screenshot ? (
              <img src={screenshot} className="w-full h-full object-cover" alt="Candidate webcam" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <div className="text-5xl mb-4">📹</div>
                <p className="font-medium">{status}</p>
                <p className="text-white/60 text-sm mt-2">Waiting for candidate to start the test</p>
              </div>
            )}
          </div>
        </div>

        {/* Info panel */}
        <div className="space-y-4">
          {/* Status card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Session Info</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Connection</span>
                <span className={`text-sm font-medium ${connected ? 'text-green-600' : 'text-yellow-600'}`}>
                  {connected ? 'Active' : 'Waiting'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Tab Switches</span>
                <span className={`text-sm font-bold ${tabSwitches > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                  {tabSwitches}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`text-sm font-medium ${terminated ? 'text-red-600' : 'text-gray-700'}`}>
                  {terminated ? 'Terminated' : status}
                </span>
              </div>
            </div>
          </div>

          {/* Terminate button */}
          {!terminated && (
            <button
              onClick={handleTerminate}
              disabled={terminating || !attemptToken}
              className="w-full py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-2xl transition-all">
              {terminating ? 'Terminating...' : '🚫 Terminate Test'}
            </button>
          )}

          {/* Alerts */}
          {tabSwitches > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-red-700 font-semibold text-sm">⚠️ Tab Switch Detected</p>
              <p className="text-red-500 text-xs mt-1">Candidate switched tabs {tabSwitches} time(s). Test may be auto-terminated.</p>
            </div>
          )}

          {terminated && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-red-700 font-semibold text-sm">🚫 Test Terminated</p>
              <p className="text-red-500 text-xs mt-1">This test session has been terminated.</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Proctoring Rules</p>
            <p>• Webcam snapshots every 2 seconds from candidate</p>
            <p>• Tab switching automatically terminates the test</p>
            <p>• Exiting fullscreen terminates the test</p>
          </div>
        </div>
      </div>
    </div>
  );
}
