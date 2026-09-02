import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getNotifications, markAllNotificationsRead } from '../api';
import { getSocket } from '../socket';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  ROUND_ASSIGNED: 'rgba(59,130,246,0.15)',
  ROUND_PASSED: 'rgba(34,197,94,0.15)',
  ROUND_FAILED: 'rgba(239,68,68,0.15)',
  ROUND_COMPLETED: 'rgba(168,85,247,0.15)',
  APPLICATION_RECEIVED: 'rgba(201,168,76,0.15)',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications.slice(0, 6));
      setUnread(data.unreadCount);
    } catch {}
  };

  useEffect(() => {
    load();
    // Fallback poll every 5 minutes in case socket misses an event
    const timer = setInterval(load, 300000);

    // Real-time: prepend new notification instantly when server pushes it
    const socket = getSocket();
    const handleNew = (n: Notification) => {
      setNotifications(prev => [n, ...prev].slice(0, 6));
      setUnread(u => u + 1);
    };
    socket.on('notification', handleNew);

    return () => {
      clearInterval(timer);
      socket.off('notification', handleNew);
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setUnread(0);
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          width: '100%', padding: '8px 10px', background: 'transparent',
          border: 'none', cursor: 'pointer', color: 'var(--text-dim)',
          fontSize: '12px', fontFamily: 'var(--font-body)', fontWeight: 500,
          textAlign: 'left', transition: 'all 0.15s ease',
          borderLeft: '2px solid transparent', position: 'relative'
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.color = 'var(--text-primary)';
          el.style.background = 'rgba(255,255,255,0.04)';
          el.style.borderLeftColor = 'rgba(201,168,76,0.3)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.color = 'var(--text-dim)';
          el.style.background = 'transparent';
          el.style.borderLeftColor = 'transparent';
        }}
      >
        <span style={{ position: 'relative', display: 'flex' }}>
          <Bell style={{ width: '18px', height: '18px' }} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: '-5px', right: '-6px',
              background: '#ef4444', color: '#fff',
              fontSize: '9px', fontWeight: 700, lineHeight: 1,
              padding: '2px 4px', borderRadius: '999px', minWidth: '14px',
              textAlign: 'center'
            }}>{unread > 9 ? '9+' : unread}</span>
          )}
        </span>
        Notifications
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '40px', left: '10px',
          width: '300px', background: 'var(--obsidian-2)',
          border: '1px solid var(--border-subtle)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 999, borderRadius: '2px', overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notifications</span>
            {unread > 0 && (
              <button onClick={handleMarkAll} style={{ fontSize: '11px', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
              No notifications yet
            </div>
          ) : (
            <>
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: n.read ? 'transparent' : 'rgba(201,168,76,0.04)',
                      borderLeft: `3px solid ${n.read ? 'transparent' : 'var(--gold)'}`,
                      cursor: n.link ? 'pointer' : 'default'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{
                        width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, marginTop: '4px',
                        background: TYPE_COLORS[n.type] ? 'var(--gold)' : 'var(--text-dim)',
                        opacity: n.read ? 0.3 : 1
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{n.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.body}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>{timeAgo(n.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                style={{
                  display: 'block', padding: '10px 14px', textAlign: 'center',
                  fontSize: '11px', color: 'var(--gold)', textDecoration: 'none',
                  borderTop: '1px solid var(--border-subtle)',
                  fontWeight: 600, letterSpacing: '0.04em'
                }}
              >
                View all notifications →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
