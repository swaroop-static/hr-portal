import { useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  senderName: string;
  message: string;
  timestamp: number;
  isOwn: boolean;
}

export interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserName: string;
  onSendMessage: (message: string) => void;
}

export default function ChatPanel({ messages, currentUserName: _currentUserName, onSendMessage }: ChatPanelProps) {
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const msg = chatInput.trim();
    if (!msg) return;
    onSendMessage(msg);
    setChatInput('');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Message list */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 12px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.length === 0 && (
          <p style={{ color: '#475569', fontSize: 12, textAlign: 'center', margin: '24px 0' }}>
            No messages yet. Say hi!
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex', flexDirection: 'column',
              alignItems: m.isOwn ? 'flex-end' : 'flex-start', gap: 3,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
                {m.isOwn ? 'You' : m.senderName}
              </span>
              <span style={{ fontSize: 10, color: '#475569' }}>
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div style={{
              maxWidth: '80%',
              background: m.isOwn ? '#1d4ed8' : '#1e2d40',
              color: '#f1f5f9',
              borderRadius: m.isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '8px 12px', fontSize: 13, wordBreak: 'break-word', lineHeight: 1.5,
            }}>
              {m.message}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        flexShrink: 0, display: 'flex', gap: 8,
        padding: '10px 12px', borderTop: '1px solid #1e2d40',
      }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          style={{
            flex: 1, background: '#0f172a', color: '#f1f5f9',
            border: '1px solid #1e2d40', borderRadius: 8, padding: '8px 12px',
            fontSize: 13, transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#1e2d40'; }}
        />
        <button
          className="chat-send"
          onClick={handleSend}
          style={{
            background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            transition: 'background 0.15s',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
