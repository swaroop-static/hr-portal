import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { getRoundForInterview, updateLiveNotes, runCode as apiRunCode, submitScorecard, submitCandidateFeedback, logInterviewEvent, saveRoundSession } from '../api';
import { useAuth } from '../context/AuthContext';

import VideoPanel from '../components/interview/VideoPanel';
import ChatPanel, { ChatMessage } from '../components/interview/ChatPanel';
import NotesPanel from '../components/interview/NotesPanel';
import CodeEditorPanel, { CodeOutput } from '../components/interview/CodeEditorPanel';
import WhiteboardPanel from '../components/interview/WhiteboardPanel';
import ScorecardModal, { ScorecardState } from '../components/interview/ScorecardModal';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

type Status = 'loading' | 'error' | 'waiting' | 'connecting' | 'connected' | 'ended';
type Panel = 'notes' | 'chat' | 'code' | 'whiteboard' | null;

function resolveResumeUrl(p: string | null | undefined): string | null {
  if (!p) return null;
  if (p.startsWith('/api/uploads')) return p;
  if (p.startsWith('/uploads/')) return p.replace('/uploads/', '/api/uploads/');
  return '/api/uploads/' + p.replace(/^\/+/, '');
}

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Icons ────────────────────────────────────────────────────
function MicIcon({ off }: { off: boolean }) {
  return off ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
function CamIcon({ off }: { off: boolean }) {
  return off ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
function PhoneOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.42 8.72" />
      <path d="M10.68 13.31A16 16 0 0 1 7.27 9.9L8.54 8.63a2 2 0 0 0 .45-2.11 12.84 12.84 0 0 1-.7-2.81 2 2 0 0 0-2-1.72H3a2 2 0 0 0-2 2.18 19.79 19.79 0 0 0 .94 4.2" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function ScreenIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function NotesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

// ── CtrlBtn helper ───────────────────────────────────────────
function CtrlBtn({ onClick, active, danger, muted: mutedStyle, sharing, label, badge, children }: {
  onClick: () => void; active?: boolean; danger?: boolean; muted?: boolean; sharing?: boolean; label: string;
  badge?: number; children: React.ReactNode;
}) {
  let bg = '#0f172a';
  let color = '#94a3b8';

  if (danger) { bg = '#dc2626'; color = '#fff'; }
  else if (mutedStyle) { bg = 'rgba(127,29,29,0.8)'; color = '#fca5a5'; }
  else if (sharing) { bg = 'rgba(34,197,94,0.15)'; color = '#22c55e'; }
  else if (active) { bg = 'rgba(59,130,246,0.15)'; color = '#3b82f6'; }

  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 3, padding: '0', width: 56, height: 48, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: bg, color: color, transition: 'all 0.15s',
      }}
    >
      {children}
      <span style={{ fontSize: 9, fontWeight: danger ? 700 : 500, lineHeight: 1 }}>{label}</span>
      {badge ? (
        <span style={{
          position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff',
          borderRadius: '50%', width: 16, height: 16, fontSize: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
        }}>{badge > 9 ? '9+' : badge}</span>
      ) : null}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────
export default function InterviewRoom() {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Core
  const [status, setStatus] = useState<Status>('loading');
  const [round, setRound] = useState<any>(null);
  const [myRole, setMyRole] = useState<'interviewer' | 'candidate'>('candidate');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peerName, setPeerName] = useState('');

  // Timer
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Screen share
  const [screenSharing, setScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Event logging refs
  const hasLoggedWhiteboardRef = useRef(false);
  const peerConnectedRef = useRef(false);

  // Bookmark UI state
  const [showBookmarkForm, setShowBookmarkForm] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');

  // Panel
  const [activePanel, setActivePanel] = useState<Panel>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);

  // Notes
  const [liveNotes, setLiveNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Code editor
  const [code, setCode] = useState('// Write your solution here\n');
  const [language, setLanguage] = useState<'javascript' | 'python'>('javascript');
  const [codeOutput, setCodeOutput] = useState<CodeOutput | null>(null);
  const [codeRunning, setCodeRunning] = useState(false);
  const codeSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Problem statement
  const [problem, setProblem] = useState('');
  const problemSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whiteboard
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const snapshotRef = useRef<ImageData | null>(null);
  const [wbTool, setWbTool] = useState<'pen' | 'rect' | 'ellipse' | 'arrow' | 'eraser'>('pen');
  const [wbColor, setWbColor] = useState('#FACC15');
  const [wbSize, setWbSize] = useState(3);

  interface WbStroke {
    tool: 'pen' | 'rect' | 'ellipse' | 'arrow' | 'eraser';
    color: string;
    size: number;
    points: { x: number; y: number }[];
  }
  const strokesRef = useRef<WbStroke[]>([]);
  const currentStrokeRef = useRef<WbStroke | null>(null);

  // Leave modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveStep, setLeaveStep] = useState<'ask' | 'feedback'>('ask');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Candidate feedback modal (shown when interview-ended received)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [candidateFeedback, setCandidateFeedback] = useState({ respect: 0, clarity: 0, overall: 0, comment: '' });
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Scorecard
  const [scorecard, setScorecard] = useState<ScorecardState>({
    categories: [
      { name: 'Problem Solving', score: 0 },
      { name: 'Coding Skills', score: 0 },
      { name: 'Communication', score: 0 },
      { name: 'System Design', score: 0 },
      { name: 'Culture Fit', score: 0 },
    ],
    recommendation: '',
    overallNotes: '',
  });

  // WebRTC
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const isNonCandidate = user?.role !== 'CANDIDATE' || myRole !== 'candidate';
  const resumeUrl = resolveResumeUrl(round?.application?.resumePath);

  // Session recovery: restore code, chat, and whiteboard from localStorage on mount
  useEffect(() => {
    const savedCode = localStorage.getItem(`wb_code_${roundId}`);
    if (savedCode) setCode(savedCode);

    const savedChat = localStorage.getItem(`wb_chat_${roundId}`);
    if (savedChat) {
      try {
        const messages = JSON.parse(savedChat);
        if (Array.isArray(messages)) setChatMessages(messages);
      } catch {}
    }

    setTimeout(() => {
      const savedCanvas = localStorage.getItem(`wb_canvas_${roundId}`);
      if (savedCanvas) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0);
        };
        img.src = savedCanvas;
      }
    }, 100);

    const savedTimerStart = localStorage.getItem(`wb_timer_${roundId}`);
    if (savedTimerStart) {
      const elapsed = Math.floor((Date.now() - Number(savedTimerStart)) / 1000);
      if (elapsed > 0) setCallDuration(elapsed);
    }
  }, []);

  // Persist code to localStorage whenever it changes
  useEffect(() => {
    if (code) localStorage.setItem(`wb_code_${roundId}`, code);
  }, [code, roundId]);

  // Server-side auto-save of code (debounced 3s)
  useEffect(() => {
    if (!code || !roundId) return;
    if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
    sessionSaveTimer.current = setTimeout(() => {
      saveRoundSession(roundId, { code, language }).catch(() => {});
    }, 3000);
    return () => { if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current); };
  }, [code, language, roundId]);

  // Timer: start when connected, stop otherwise
  useEffect(() => {
    if (status === 'connected') {
      if (!localStorage.getItem(`wb_timer_${roundId}`)) {
        const timerStart = (Date.now() - callDuration * 1000).toString();
        localStorage.setItem(`wb_timer_${roundId}`, timerStart);
        saveRoundSession(roundId!, { timerStart }).catch(() => {});
      }
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  // Re-attach local stream when DOM changes
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
  }, [status]);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    socketRef.current?.emit('interview-leave', { roundId });
    socketRef.current?.disconnect();
  }, [roundId]);

  function buildPc(socket: Socket, stream: MediaStream) {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
    }
    iceCandidateQueueRef.current = [];
    remoteDescSetRef.current = false;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
        remoteVideoRef.current.play().catch(() => {});
      }
      setStatus('connected');
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('interview-ice', { roundId, candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') setStatus('waiting');
    };
    return pc;
  }

  async function drainIceQueue() {
    remoteDescSetRef.current = true;
    const queue = iceCandidateQueueRef.current.splice(0);
    for (const c of queue) { try { await pcRef.current?.addIceCandidate(c); } catch {} }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      let data: any;
      try { data = await getRoundForInterview(roundId!); }
      catch (e: any) {
        if (!cancelled) { setError(e?.response?.data?.error || 'Failed to load interview.'); setStatus('error'); }
        return;
      }
      if (cancelled) return;
      setRound(data.round);
      if (data.round.type === 'TECHNICAL_INTERVIEW') {
        setActivePanel('code');
      }

      // Restore server session if localStorage doesn't have this session
      if (data.round.sessionData) {
        try {
          const session = JSON.parse(data.round.sessionData);
          if (!localStorage.getItem(`wb_code_${roundId}`) && session.code) {
            setCode(session.code);
            if (session.language) setLanguage(session.language);
          }
          if (!localStorage.getItem(`wb_chat_${roundId}`) && session.chatHistory?.length) {
            setChatMessages(session.chatHistory);
          }
          if (!localStorage.getItem(`wb_timer_${roundId}`) && session.timerStart) {
            localStorage.setItem(`wb_timer_${roundId}`, session.timerStart);
            const elapsed = Math.floor((Date.now() - Number(session.timerStart)) / 1000);
            if (elapsed > 0) setCallDuration(elapsed);
          }
          if (!localStorage.getItem(`wb_canvas_${roundId}`) && session.canvas) {
            setTimeout(() => {
              const img = new Image();
              img.onload = () => {
                const ctx = canvasRef.current?.getContext('2d');
                if (ctx) ctx.drawImage(img, 0, 0);
              };
              img.src = session.canvas;
            }, 200);
          }
        } catch {}
      }

      setMyRole(data.role);
      setLiveNotes(data.round.liveNotes || '');
      const isInterviewer = data.role === 'interviewer';
      setPeerName(isInterviewer ? data.round.application?.candidateName : (data.round.interviewer?.name || 'Interviewer'));

      let stream: MediaStream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }); }
      catch {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); }
        catch {
          if (!cancelled) { setError('Microphone access denied. Please allow microphone and reload.'); setStatus('error'); }
          return;
        }
      }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      localStreamRef.current = stream;
      if (localVideoRef.current) { localVideoRef.current.srcObject = stream; localVideoRef.current.play().catch(() => {}); }

      const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
        auth: { token: localStorage.getItem('hr_portal_token') },
        reconnection: true,
      });
      socketRef.current = socket;

      socket.on('connect', () => { socket.emit('join-interview-room', { roundId }); setStatus('waiting'); });

      socket.on('interview-peer-joined', async () => {
        setStatus('connecting');
        if (!peerConnectedRef.current) {
          peerConnectedRef.current = true;
          logInterviewEvent(roundId!, {
            eventType: 'INTERVIEW_STARTED',
            actorRole: isInterviewer ? 'INTERVIEWER' : 'CANDIDATE',
            actorName: data.role === 'interviewer' ? data.round.interviewer?.name : data.round.application?.candidateName,
          }).catch(() => {});
        }
        // Sync current whiteboard strokes to late-joining peer
        if (strokesRef.current.length > 0) {
          socket.emit('interview-whiteboard-strokes-sync', { roundId, strokes: strokesRef.current });
        }
        if (!isInterviewer) return;
        const pc = buildPc(socket, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('interview-offer', { roundId, offer });
      });

      socket.on('interview-offer', async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
        setStatus('connecting');
        const pc = buildPc(socket, stream);
        await pc.setRemoteDescription(offer);
        await drainIceQueue();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('interview-answer', { roundId, answer });
      });

      socket.on('interview-answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(answer);
        await drainIceQueue();
      });

      socket.on('interview-ice', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        if (!remoteDescSetRef.current) { iceCandidateQueueRef.current.push(candidate); return; }
        try { await pcRef.current?.addIceCandidate(candidate); } catch {}
      });

      socket.on('interview-peer-left', () => {
        setStatus('waiting');
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        pcRef.current?.close(); pcRef.current = null;
        iceCandidateQueueRef.current = []; remoteDescSetRef.current = false;
      });

      socket.on('interview-chat', ({ message, senderName, timestamp }: any) => {
        setChatMessages(prev => {
          const updatedMessages = [...prev, { message, senderName, timestamp, isOwn: false }];
          localStorage.setItem(`wb_chat_${roundId}`, JSON.stringify(updatedMessages));
          saveRoundSession(roundId!, { chatHistory: updatedMessages }).catch(() => {});
          return updatedMessages;
        });
        setUnreadChat(prev => (activePanel === 'chat' ? 0 : prev + 1));
      });

      socket.on('interview-code-sync', ({ code: incomingCode, language: incomingLang }: any) => {
        if (isInterviewer) { setCode(incomingCode); setLanguage(incomingLang); }
      });

      socket.on('interview-code-output', (output: CodeOutput) => {
        setCodeOutput(output); setCodeRunning(false);
      });

      socket.on('interview-ended', () => {
        logInterviewEvent(roundId!, {
          eventType: 'INTERVIEW_ENDED',
          actorRole: isInterviewer ? 'INTERVIEWER' : 'CANDIDATE',
          actorName: data.role === 'interviewer' ? data.round.interviewer?.name : data.round.application?.candidateName,
        }).catch(() => {});
        if (data.role === 'candidate') {
          setShowFeedbackModal(true);
        }
        setStatus('ended');
      });

      socket.on('interview-code-problem', ({ problem: incomingProblem }: { problem: string }) => {
        setProblem(incomingProblem);
      });

      socket.on('interview-whiteboard-stroke', ({ stroke }: { stroke: WbStroke }) => {
        strokesRef.current = [...strokesRef.current, stroke];
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) drawStroke(ctx, stroke);
        // Update localStorage
        const pngDataUrl = canvasRef.current?.toDataURL('image/png');
        if (pngDataUrl) localStorage.setItem(`wb_canvas_${roundId}`, pngDataUrl);
      });

      socket.on('interview-whiteboard-strokes-sync', ({ strokes }: { strokes: WbStroke[] }) => {
        strokesRef.current = strokes;
        replayStrokes(strokes);
        const pngDataUrl = canvasRef.current?.toDataURL('image/png');
        if (pngDataUrl) localStorage.setItem(`wb_canvas_${roundId}`, pngDataUrl);
      });

      socket.on('interview-whiteboard-clear', () => {
        strokesRef.current = [];
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      });
    }
    init();
    return () => { cancelled = true; cleanup(); };
  }, [roundId]);

  const toggleMute = () => { localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; }); setMuted(m => !m); };
  const toggleVideo = () => { localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; }); setVideoOff(v => !v); };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      const webcamTrack = localStreamRef.current?.getVideoTracks()[0];
      if (webcamTrack) {
        const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
        await sender?.replaceTrack(webcamTrack);
      }
      setScreenSharing(false);
    } else {
      try {
        const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        screenStreamRef.current = screen;
        const screenTrack = screen.getVideoTracks()[0];
        const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
        await sender?.replaceTrack(screenTrack);
        screenTrack.onended = () => { toggleScreenShare(); };
        setScreenSharing(true);
        logInterviewEvent(roundId!, {
          eventType: 'SCREEN_SHARE_STARTED',
          actorRole: myRole === 'interviewer' ? 'INTERVIEWER' : 'CANDIDATE',
          actorName: user?.name,
        }).catch(() => {});
      } catch {}
    }
  };

  const togglePanel = (p: Panel) => {
    setActivePanel(prev => prev === p ? null : p);
    if (p === 'chat') setUnreadChat(0);
  };

  const sendChat = (msg: string) => {
    if (!msg || !socketRef.current) return;
    const timestamp = Date.now();
    socketRef.current.emit('interview-chat', { roundId, message: msg, senderName: user?.name || 'You', timestamp });
    setChatMessages(prev => {
      const updatedMessages = [...prev, { message: msg, senderName: user?.name || 'You', timestamp, isOwn: true }];
      localStorage.setItem(`wb_chat_${roundId}`, JSON.stringify(updatedMessages));
      saveRoundSession(roundId!, { chatHistory: updatedMessages }).catch(() => {});
      return updatedMessages;
    });
  };

  const handleNotesChange = (val: string) => {
    setLiveNotes(val);
    setNotesSaving('saving');
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(async () => {
      try { await updateLiveNotes(roundId!, val); setNotesSaving('saved'); }
      catch { setNotesSaving('idle'); }
    }, 600);
  };

  const handleCodeChange = (val: string | undefined) => {
    const v = val ?? '';
    setCode(v);
    if (myRole === 'candidate') {
      if (codeSyncTimer.current) clearTimeout(codeSyncTimer.current);
      codeSyncTimer.current = setTimeout(() => {
        socketRef.current?.emit('interview-code-sync', { roundId, code: v, language });
      }, 300);
    }
  };

  const handleLanguageChange = (lang: 'javascript' | 'python') => {
    setLanguage(lang);
    if (myRole === 'candidate') {
      socketRef.current?.emit('interview-code-sync', { roundId, code, language: lang });
    }
  };

  const handleRunCode = async () => {
    setCodeRunning(true); setCodeOutput(null);
    logInterviewEvent(roundId!, {
      eventType: 'CODE_RAN',
      actorRole: myRole === 'interviewer' ? 'INTERVIEWER' : 'CANDIDATE',
      actorName: user?.name,
      metadata: { language },
    }).catch(() => {});
    try { await apiRunCode(roundId!, code, language); }
    catch { setCodeRunning(false); }
  };

  const handleProblemChange = (val: string) => {
    setProblem(val);
    if (problemSyncTimer.current) clearTimeout(problemSyncTimer.current);
    problemSyncTimer.current = setTimeout(() => {
      socketRef.current?.emit('interview-code-problem', { roundId, problem: val });
    }, 400);
  };

  // ── Whiteboard handlers ──
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: WbStroke) => {
    if (stroke.points.length === 0) return;
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#1a1a2e' : stroke.color;
    ctx.lineWidth = stroke.tool === 'eraser' ? stroke.size * 4 : stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const p of stroke.points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (stroke.points.length >= 2) {
      const first = stroke.points[0];
      const last = stroke.points[stroke.points.length - 1];
      ctx.beginPath();
      if (stroke.tool === 'rect') {
        ctx.strokeRect(first.x, first.y, last.x - first.x, last.y - first.y);
      } else if (stroke.tool === 'ellipse') {
        ctx.ellipse(
          first.x + (last.x - first.x) / 2, first.y + (last.y - first.y) / 2,
          Math.abs(last.x - first.x) / 2, Math.abs(last.y - first.y) / 2,
          0, 0, 2 * Math.PI
        );
        ctx.stroke();
      } else if (stroke.tool === 'arrow') {
        ctx.moveTo(first.x, first.y);
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
        const angle = Math.atan2(last.y - first.y, last.x - first.x);
        const len = 14;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(last.x - len * Math.cos(angle - 0.4), last.y - len * Math.sin(angle - 0.4));
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(last.x - len * Math.cos(angle + 0.4), last.y - len * Math.sin(angle + 0.4));
        ctx.stroke();
      }
    }
  }, []);

  const replayStrokes = useCallback((strokes: WbStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokes) drawStroke(ctx, s);
  }, [drawStroke]);

  const handleWbMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current!.getContext('2d')!;
    isDrawingRef.current = true;
    const pos = getCanvasPos(e);
    startPosRef.current = pos;
    snapshotRef.current = ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    currentStrokeRef.current = { tool: wbTool, color: wbColor, size: wbSize, points: [pos] };
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    if (!hasLoggedWhiteboardRef.current) {
      hasLoggedWhiteboardRef.current = true;
      logInterviewEvent(roundId!, {
        eventType: 'WHITEBOARD_USED',
        actorRole: myRole === 'interviewer' ? 'INTERVIEWER' : 'CANDIDATE',
        actorName: user?.name,
      }).catch(() => {});
    }
  };

  const handleWbMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getCanvasPos(e);
    if (currentStrokeRef.current) currentStrokeRef.current.points.push(pos);
    ctx.strokeStyle = wbTool === 'eraser' ? '#1a1a2e' : wbColor;
    ctx.lineWidth = wbTool === 'eraser' ? wbSize * 4 : wbSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (wbTool === 'pen' || wbTool === 'eraser') {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      ctx.putImageData(snapshotRef.current!, 0, 0);
      const { x: sx, y: sy } = startPosRef.current;
      ctx.beginPath();
      if (wbTool === 'rect') {
        ctx.strokeRect(sx, sy, pos.x - sx, pos.y - sy);
      } else if (wbTool === 'ellipse') {
        ctx.ellipse(
          sx + (pos.x - sx) / 2, sy + (pos.y - sy) / 2,
          Math.abs(pos.x - sx) / 2, Math.abs(pos.y - sy) / 2,
          0, 0, 2 * Math.PI
        );
        ctx.stroke();
      } else if (wbTool === 'arrow') {
        ctx.moveTo(sx, sy);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        const angle = Math.atan2(pos.y - sy, pos.x - sx);
        const len = 14;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x - len * Math.cos(angle - 0.4), pos.y - len * Math.sin(angle - 0.4));
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x - len * Math.cos(angle + 0.4), pos.y - len * Math.sin(angle + 0.4));
        ctx.stroke();
      }
    }
  };

  const handleWbMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (!stroke || stroke.points.length === 0) return;

    // Add to local strokes history
    strokesRef.current = [...strokesRef.current, stroke];

    // Emit vector stroke to peer (not JPEG)
    socketRef.current?.emit('interview-whiteboard-stroke', { roundId, stroke });

    // Save canvas to localStorage and server (debounced) for same-device recovery
    const pngDataUrl = canvasRef.current?.toDataURL('image/png');
    if (pngDataUrl) localStorage.setItem(`wb_canvas_${roundId}`, pngDataUrl);
    if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
    sessionSaveTimer.current = setTimeout(() => {
      const dataUrl = canvasRef.current?.toDataURL('image/jpeg', 0.5);
      if (dataUrl) saveRoundSession(roundId!, { canvas: dataUrl }).catch(() => {});
    }, 5000);
  };

  const clearWhiteboard = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [];
    socketRef.current?.emit('interview-whiteboard-clear', { roundId });
    localStorage.removeItem(`wb_canvas_${roundId}`);
  };

  const handleUndo = () => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    replayStrokes(strokesRef.current);
    // Notify peer of updated strokes
    socketRef.current?.emit('interview-whiteboard-strokes-sync', { roundId, strokes: strokesRef.current });
  };

  const handleAddBookmark = () => {
    logInterviewEvent(roundId!, {
      eventType: 'BOOKMARK',
      actorRole: myRole === 'interviewer' ? 'INTERVIEWER' : 'CANDIDATE',
      actorName: user?.name,
      metadata: bookmarkNote ? { note: bookmarkNote } : undefined,
    }).catch(() => {});
    setBookmarkNote('');
    setShowBookmarkForm(false);
  };

  const handleLeaveNow = () => {
    socketRef.current?.emit('interview-end', { roundId });
    cleanup(); setStatus('ended');
    if (myRole === 'interviewer') {
      navigate('/interviewer');
    }
  };

  const handleSubmitScorecard = async () => {
    setFeedbackSubmitting(true);
    logInterviewEvent(roundId!, {
      eventType: 'SCORE_SUBMITTED',
      actorRole: 'INTERVIEWER',
      actorName: user?.name,
      metadata: { recommendation: scorecard.recommendation },
    }).catch(() => {});
    try {
      await submitScorecard(roundId!, scorecard);
    } catch {}
    handleLeaveNow();
    setTimeout(() => navigate('/interviewer'), 1500);
  };

  const handleSubmitCandidateFeedback = async () => {
    try {
      await submitCandidateFeedback(roundId!, candidateFeedback);
      setFeedbackSubmitted(true);
      setTimeout(() => { setShowFeedbackModal(false); navigate('/candidate/dashboard'); }, 2000);
    } catch {
      setShowFeedbackModal(false);
      navigate('/candidate/dashboard');
    }
  };

  // ── Derived ──
  const statusDot = { waiting: '#fbbf24', connecting: '#60a5fa', connected: '#22c55e' }[status] || '#6b7280';
  const statusLabel = { waiting: `Waiting for ${peerName}...`, connecting: 'Connecting...', connected: 'Connected' }[status] || '';
  const roundTypeLabel: Record<string, string> = { TECHNICAL_INTERVIEW: 'Technical Interview', HR_INTERVIEW: 'HR Interview', FINAL_INTERVIEW: 'Final Interview' };

  // ── Loading / Error / Ended screens ──
  if (status === 'loading') return (
    <div style={{ height: '100vh', background: '#0a0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #1e3a5f', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
        <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>Setting up interview room...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse-ring{0%{box-shadow:0 0 0 0 rgba(59,130,246,0.4)}70%{box-shadow:0 0 0 14px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
    </div>
  );

  if (status === 'error') return (
    <div style={{ height: '100vh', background: '#0a0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#0f172a', border: '1px solid #7f1d1d', borderRadius: 12, padding: '28px 32px', maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 17, margin: '0 0 8px' }}>Cannot join interview</h2>
        <p style={{ color: '#fca5a5', fontSize: 13, margin: '0 0 20px' }}>{error}</p>
        <button onClick={() => navigate(-1)} style={{ padding: '9px 22px', background: '#1e2d40', color: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Go back</button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse-ring{0%{box-shadow:0 0 0 0 rgba(59,130,246,0.4)}70%{box-shadow:0 0 0 14px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
    </div>
  );

  if (status === 'ended') return (
    <div style={{ height: '100vh', background: '#0a0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0f172a', border: '1px solid #1e2d40', borderRadius: 12, padding: '36px 44px', maxWidth: 380, width: '100%', textAlign: 'center' }}>
        <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 20, margin: '0 0 8px' }}>Interview ended</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 20px' }}>You have left the interview room.</p>
        <button onClick={() => navigate(-1)} style={{ padding: '9px 22px', background: '#1e3a5f', color: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Back to Dashboard</button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse-ring{0%{box-shadow:0 0 0 0 rgba(59,130,246,0.4)}70%{box-shadow:0 0 0 14px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}} @keyframes blink{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>

      {/* Candidate feedback modal overlaid on ended screen */}
      {showFeedbackModal && myRole === 'candidate' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, width: 440, maxWidth: '90vw' }}>
            {feedbackSubmitted ? (
              <div style={{ textAlign: 'center', color: '#4ade80', fontSize: 18, fontWeight: 600 }}>
                Thanks for your feedback! ✓
              </div>
            ) : (
              <>
                <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>How was your interview?</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 }}>Rate your experience to help us improve.</p>
                {(['respect', 'clarity', 'overall'] as const).map(key => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 6, textTransform: 'capitalize' }}>
                      {key === 'respect' ? 'Professionalism & Respect' : key === 'clarity' ? 'Question Clarity' : 'Overall Experience'}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setCandidateFeedback(f => ({ ...f, [key]: n }))}
                          style={{ fontSize: 24, cursor: 'pointer', background: 'none', border: 'none', padding: 0,
                            color: n <= candidateFeedback[key] ? '#FACC15' : 'rgba(255,255,255,0.2)' }}>
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <textarea
                  value={candidateFeedback.comment}
                  onChange={e => setCandidateFeedback(f => ({ ...f, comment: e.target.value }))}
                  placeholder="Any additional comments? (optional)"
                  rows={3}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 14, resize: 'none',
                    marginBottom: 20, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleSubmitCandidateFeedback}
                    disabled={candidateFeedback.respect === 0 || candidateFeedback.clarity === 0 || candidateFeedback.overall === 0}
                    style={{ flex: 1, padding: '10px 0', background: '#FACC15', color: '#000', border: 'none',
                      borderRadius: 8, fontWeight: 600, cursor: 'pointer', opacity: (candidateFeedback.respect && candidateFeedback.clarity && candidateFeedback.overall) ? 1 : 0.5 }}>
                    Submit Feedback
                  </button>
                  <button onClick={() => { setShowFeedbackModal(false); navigate('/candidate/dashboard'); }}
                    style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer' }}>
                    Skip
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ── Main UI ──
  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: '#0a0f1a', display: 'flex', flexDirection: 'column' }}>

      {/* Global keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4) } 70% { box-shadow: 0 0 0 14px rgba(59,130,246,0) } 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0) } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.35} }
        .ctrl-btn:hover { filter: brightness(1.15); }
        .panel-close:hover { color: #ef4444 !important; }
        .chat-send:hover { background: #2563eb !important; }
        .resume-btn:hover { background: rgba(139,92,246,0.15) !important; }
        .run-btn:hover:not(:disabled) { filter: brightness(1.1); }
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
        textarea:focus { outline: none; }
        input:focus { outline: none; }
        select { outline: none; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2d40; border-radius: 4px; }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        flexShrink: 0, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1e2d40', zIndex: 10,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            display: 'inline-block', border: '1px solid #3b82f6', color: '#93c5fd',
            padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
            letterSpacing: '0.04em', lineHeight: 1.5, alignSelf: 'flex-start',
          }}>
            {roundTypeLabel[round?.type] || 'Interview'}
          </span>
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
            {round?.application?.candidateName || 'Candidate'}
          </span>
          <span style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1 }}>
            {round?.application?.position?.title || ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: statusDot,
            display: 'inline-block', boxShadow: `0 0 6px ${statusDot}`,
          }} />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{statusLabel}</span>
          {status === 'connected' && (
            <>
              <span style={{ color: '#475569', fontSize: 12 }}>·</span>
              <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{fmt(callDuration)}</span>
            </>
          )}
          <span style={{ color: '#475569', fontSize: 12 }}>·</span>
          <span style={{ color: '#475569', fontSize: 11 }}>HR Portal</span>
        </div>
      </div>

      {/* ── Resume bar ── */}
      {isNonCandidate && resumeUrl && (
        <div style={{
          flexShrink: 0, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', background: 'rgba(139,92,246,0.07)', borderBottom: '1px solid rgba(139,92,246,0.18)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center' }}><FileIcon /></span>
            <span style={{ color: '#c4b5fd', fontSize: 12 }}>
              {round?.application?.resumeName || 'Candidate Resume'}
            </span>
          </div>
          <a
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="resume-btn"
            style={{
              border: '1px solid #8b5cf6', color: '#8b5cf6', borderRadius: 6,
              padding: '3px 12px', fontSize: 11, background: 'transparent', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', transition: 'background 0.15s',
            }}
          >
            Open Resume
          </a>
        </div>
      )}

      {/* ── Content area: video + panel ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Video area */}
        <VideoPanel
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          status={status}
          myRole={myRole}
          muted={muted}
          videoOff={videoOff}
          peerName={peerName}
          callDuration={callDuration}
          screenSharing={screenSharing}
        />

        {/* ── Right panel ── */}
        {activePanel && (
          <div style={{
            width: activePanel === 'code' || activePanel === 'whiteboard' ? '52%' : '360px', flexShrink: 0,
            borderLeft: '1px solid #1e2d40', display: 'flex', flexDirection: 'column',
            background: '#0a0f1a', overflow: 'hidden',
          }}>

            {/* Panel header */}
            <div style={{
              flexShrink: 0, height: 48, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '0 16px',
              background: '#0f172a', borderBottom: '1px solid #1e2d40',
            }}>
              <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>
                {activePanel === 'notes' ? 'Interview Notes' : activePanel === 'chat' ? 'Chat' : activePanel === 'whiteboard' ? 'Whiteboard' : 'Code Editor'}
              </span>
              <button
                className="panel-close"
                onClick={() => setActivePanel(null)}
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 20, lineHeight: 1, transition: 'color 0.15s', padding: '0 2px' }}
              >
                ×
              </button>
            </div>

            {/* ── Notes panel ── */}
            {activePanel === 'notes' && (
              <NotesPanel
                liveNotes={liveNotes}
                onNotesChange={handleNotesChange}
                notesSaving={notesSaving}
                isNonCandidate={isNonCandidate}
              />
            )}

            {/* ── Chat panel ── */}
            {activePanel === 'chat' && (
              <ChatPanel
                messages={chatMessages}
                currentUserName={user?.name || 'You'}
                onSendMessage={sendChat}
              />
            )}

            {/* ── Whiteboard panel ── */}
            {activePanel === 'whiteboard' && (
              <WhiteboardPanel
                canvasRef={canvasRef}
                wbTool={wbTool}
                wbColor={wbColor}
                wbSize={wbSize}
                onToolChange={setWbTool}
                onColorChange={setWbColor}
                onSizeChange={setWbSize}
                onClear={clearWhiteboard}
                onUndo={handleUndo}
                onMouseDown={handleWbMouseDown}
                onMouseMove={handleWbMouseMove}
                onMouseUp={handleWbMouseUp}
              />
            )}

            {/* ── Code editor panel ── */}
            {activePanel === 'code' && (
              <CodeEditorPanel
                code={code}
                language={language}
                onCodeChange={handleCodeChange}
                onLanguageChange={handleLanguageChange}
                onRunCode={handleRunCode}
                codeOutput={codeOutput}
                codeRunning={codeRunning}
                problem={problem}
                onProblemChange={handleProblemChange}
                isNonCandidate={isNonCandidate}
                myRole={myRole}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Bottom controls ── */}
      <div style={{
        flexShrink: 0, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: '0 20px', background: 'rgba(10,15,26,0.95)',
        backdropFilter: 'blur(8px)', borderTop: '1px solid #1e2d40',
        position: 'relative',
      }}>
        <CtrlBtn onClick={toggleMute} muted={muted} label={muted ? 'Unmute' : 'Mute'}>
          <MicIcon off={muted} />
        </CtrlBtn>
        <CtrlBtn onClick={toggleVideo} muted={videoOff} label={videoOff ? 'Cam Off' : 'Camera'}>
          <CamIcon off={videoOff} />
        </CtrlBtn>
        <CtrlBtn onClick={toggleScreenShare} sharing={screenSharing} label={screenSharing ? 'Stop Share' : 'Share'}>
          <ScreenIcon active={screenSharing} />
        </CtrlBtn>
        <CtrlBtn onClick={() => togglePanel('chat')} active={activePanel === 'chat'} label="Chat" badge={unreadChat > 0 ? unreadChat : undefined}>
          <ChatIcon />
        </CtrlBtn>
        <CtrlBtn onClick={() => togglePanel('code')} active={activePanel === 'code'} label="Code">
          <CodeIcon />
        </CtrlBtn>
        <CtrlBtn onClick={() => togglePanel('whiteboard')} active={activePanel === 'whiteboard'} label="Board">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
            <path d="M7 7l3 3 4-4"/>
          </svg>
        </CtrlBtn>
        {isNonCandidate && (
          <CtrlBtn onClick={() => togglePanel('notes')} active={activePanel === 'notes'} label="Notes">
            <NotesIcon />
          </CtrlBtn>
        )}
        {isNonCandidate && (
          <CtrlBtn onClick={() => setShowBookmarkForm(b => !b)} active={showBookmarkForm} label="Bookmark">
            <svg viewBox="0 0 24 24" fill={showBookmarkForm ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </CtrlBtn>
        )}
        {isNonCandidate && roundId && (
          <a
            href={`/interview/${roundId}/timeline`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: 0, width: 56, height: 48, borderRadius: 12,
              background: '#0f172a', color: '#94a3b8', textDecoration: 'none',
              fontSize: 9, fontWeight: 500, transition: 'all 0.15s',
            }}
            title="View Timeline"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span style={{ fontSize: 9, fontWeight: 500 }}>Timeline</span>
          </a>
        )}
        {isNonCandidate && resumeUrl && (
          <a
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: 0, width: 56, height: 48, borderRadius: 12,
              background: '#0f172a', color: '#8b5cf6', textDecoration: 'none',
              fontSize: 9, fontWeight: 500, transition: 'all 0.15s',
            }}
          >
            <FileIcon />
            <span style={{ fontSize: 9, fontWeight: 500 }}>Resume</span>
          </a>
        )}
        <CtrlBtn onClick={() => isNonCandidate ? setShowLeaveModal(true) : handleLeaveNow()} danger label="Leave">
          <PhoneOffIcon />
        </CtrlBtn>

        <span style={{ position: 'absolute', right: 18, fontSize: 11, color: '#475569' }}>
          {isNonCandidate ? 'Interviewer' : 'Candidate'}
        </span>
      </div>

      {/* ── Bookmark form overlay (interviewer only) ── */}
      {showBookmarkForm && isNonCandidate && (
        <div style={{
          position: 'fixed', bottom: 80, right: 80, zIndex: 200,
          background: '#0f172a', border: '1px solid #FACC15', borderRadius: 12,
          padding: '16px 20px', width: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: '#FACC15', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={0} width={14} height={14}>
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Add Bookmark
            </span>
            <button onClick={() => { setShowBookmarkForm(false); setBookmarkNote(''); }}
              style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
          <textarea
            value={bookmarkNote}
            onChange={e => setBookmarkNote(e.target.value)}
            placeholder="Optional note (e.g. 'Good solution', 'Communication gap')..."
            rows={3}
            autoFocus
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '8px 10px', color: '#f1f5f9', fontSize: 13, resize: 'none',
              marginBottom: 10, boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleAddBookmark}
            style={{
              width: '100%', padding: '8px 0', background: '#FACC15', color: '#000',
              border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13,
            }}
          >
            Save Bookmark
          </button>
        </div>
      )}

      {/* ── Leave modal (interviewer only) ── */}
      {showLeaveModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid #1e2d40', borderRadius: 12,
            padding: '28px 32px', maxWidth: 420, width: '90%',
          }}>
            {leaveStep === 'ask' ? (
              <>
                <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>End interview?</h2>
                <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 24px', lineHeight: 1.6 }}>
                  Would you like to submit feedback now or do it later from the dashboard?
                </p>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <button
                    onClick={() => setLeaveStep('feedback')}
                    style={{ flex: 1, padding: '10px 0', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                  >
                    Submit Now
                  </button>
                  <button
                    onClick={handleLeaveNow}
                    style={{ flex: 1, padding: '10px 0', background: '#1e2d40', color: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                  >
                    Leave Later
                  </button>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => setShowLeaveModal(false)}
                    style={{ background: 'transparent', color: '#475569', border: 'none', cursor: 'pointer', fontSize: 12, padding: '4px 0' }}
                  >
                    Cancel — stay in call
                  </button>
                </div>
              </>
            ) : (
              <ScorecardModal
                scorecard={scorecard}
                onScorecardChange={setScorecard}
                onSubmit={handleSubmitScorecard}
                onSkip={handleLeaveNow}
                onBack={() => setLeaveStep('ask')}
                isSubmitting={feedbackSubmitting}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Candidate feedback modal (shown after interview-ended) ── */}
      {showFeedbackModal && myRole === 'candidate' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, width: 440, maxWidth: '90vw' }}>
            {feedbackSubmitted ? (
              <div style={{ textAlign: 'center', color: '#4ade80', fontSize: 18, fontWeight: 600 }}>
                Thanks for your feedback! ✓
              </div>
            ) : (
              <>
                <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>How was your interview?</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 }}>Rate your experience to help us improve.</p>

                {/* Star ratings for 3 categories */}
                {(['respect', 'clarity', 'overall'] as const).map(key => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 6, textTransform: 'capitalize' }}>
                      {key === 'respect' ? 'Professionalism & Respect' : key === 'clarity' ? 'Question Clarity' : 'Overall Experience'}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setCandidateFeedback(f => ({ ...f, [key]: n }))}
                          style={{ fontSize: 24, cursor: 'pointer', background: 'none', border: 'none', padding: 0,
                            color: n <= candidateFeedback[key] ? '#FACC15' : 'rgba(255,255,255,0.2)' }}>
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Comment */}
                <textarea
                  value={candidateFeedback.comment}
                  onChange={e => setCandidateFeedback(f => ({ ...f, comment: e.target.value }))}
                  placeholder="Any additional comments? (optional)"
                  rows={3}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 14, resize: 'none',
                    marginBottom: 20, boxSizing: 'border-box' }}
                />

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleSubmitCandidateFeedback}
                    disabled={candidateFeedback.respect === 0 || candidateFeedback.clarity === 0 || candidateFeedback.overall === 0}
                    style={{ flex: 1, padding: '10px 0', background: '#FACC15', color: '#000', border: 'none',
                      borderRadius: 8, fontWeight: 600, cursor: 'pointer', opacity: (candidateFeedback.respect && candidateFeedback.clarity && candidateFeedback.overall) ? 1 : 0.5 }}>
                    Submit Feedback
                  </button>
                  <button onClick={() => { setShowFeedbackModal(false); navigate('/candidate/dashboard'); }}
                    style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer' }}>
                    Skip
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
