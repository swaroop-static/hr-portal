import React from 'react';

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

type Status = 'loading' | 'error' | 'waiting' | 'connecting' | 'connected' | 'ended';

export interface VideoPanelProps {
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  status: Status;
  myRole: 'interviewer' | 'candidate';
  muted: boolean;
  videoOff: boolean;
  peerName: string;
  callDuration: number;
  screenSharing: boolean;
}

export default function VideoPanel({
  localVideoRef,
  remoteVideoRef,
  status,
  myRole,
  muted,
  videoOff,
  peerName,
  callDuration,
  screenSharing,
}: VideoPanelProps) {
  const statusLabel = {
    waiting: `Waiting for ${peerName}...`,
    connecting: 'Connecting...',
    connected: 'Connected',
  }[status] || '';

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111827', minWidth: 0 }}>
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {/* Waiting / connecting overlay */}
      {status !== 'connected' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, background: '#111827',
        }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: 'linear-gradient(135deg,#1e3a5f,#1e3a8a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: '#fff',
            animation: status === 'waiting' ? 'pulse-ring 2s infinite' : undefined,
          }}>
            {peerName[0]?.toUpperCase() || '?'}
          </div>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>{statusLabel}</p>
        </div>
      )}

      {/* Peer label */}
      {status === 'connected' && (
        <div style={{
          position: 'absolute', bottom: 14, left: 14,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          color: '#f1f5f9', fontSize: 12, fontWeight: 600,
          padding: '4px 14px', borderRadius: 20,
        }}>
          {peerName}
        </div>
      )}

      {/* Self-view PiP */}
      <div style={{
        position: 'absolute', bottom: 14, right: 14,
        width: 180, height: 110, borderRadius: 10, overflow: 'hidden',
        border: '2px solid rgba(255,255,255,0.12)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)', background: '#1f2937',
      }}>
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }}
        />
        {videoOff && (
          <div style={{
            position: 'absolute', inset: 0, background: '#1f2937',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CamIcon off={true} />
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: 4, left: 7,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          color: '#f1f5f9', fontSize: 9, fontWeight: 600,
          padding: '2px 7px', borderRadius: 10,
        }}>
          You{screenSharing ? ' (screen)' : ''}
        </div>
        {/* Show role indicator on local video */}
        <div style={{ position: 'absolute', bottom: 4, right: 7, fontSize: 11, color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>
          {myRole === 'candidate' ? 'Candidate' : 'Interviewer'}
        </div>
      </div>
    </div>
  );
}
