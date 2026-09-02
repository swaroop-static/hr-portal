import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, ArrowLeft } from 'lucide-react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api';

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const TYPE_DOT: Record<string, string> = {
  ROUND_ASSIGNED: '#3b82f6',
  ROUND_PASSED: '#22c55e',
  ROUND_FAILED: '#ef4444',
  ROUND_COMPLETED: '#a855f7',
  APPLICATION_RECEIVED: '#c9a84c',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function groupByDay(notifications: AppNotification[]) {
  const groups: Record<string, AppNotification[]> = {};
  for (const n of notifications) {
    const day = new Date(n.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    if (!groups[day]) groups[day] = [];
    groups[day].push(n);
  }
  return groups;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications);
      setUnread(data.unreadCount);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(u => Math.max(0, u - 1));
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  const groups = groupByDay(notifications);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-yellow-400" />
                <h1 className="text-xl font-bold text-white">Notifications</h1>
                {unread > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unread}</span>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-1">Your recent activity and alerts</p>
            </div>
          </div>
          {unread > 0 && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/10 rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4 animate-pulse">
                <div className="h-3 bg-gray-700 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-700 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No notifications yet</p>
            <p className="text-gray-500 text-sm mt-1">You'll see activity here as it happens</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groups).map(([day, items]) => (
              <div key={day}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{day}</p>
                <div className="space-y-2">
                  {items.map(n => {
                    const dot = TYPE_DOT[n.type] || '#6b7280';
                    const content = (
                      <div
                        key={n.id}
                        onClick={() => !n.read && handleMarkRead(n.id)}
                        className={`flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer ${
                          n.read
                            ? 'bg-gray-800/50 border-gray-700/50'
                            : 'bg-gray-800 border-gray-700 shadow-sm'
                        }`}
                      >
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '6px', background: dot, opacity: n.read ? 0.4 : 1 }} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold mb-0.5 ${n.read ? 'text-gray-400' : 'text-white'}`}>
                            {n.title}
                          </div>
                          <div className="text-sm text-gray-400">{n.body}</div>
                          <div className="text-xs text-gray-500 mt-1">{formatDate(n.createdAt)}</div>
                        </div>
                        {!n.read && (
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c9a84c', flexShrink: 0, marginTop: '8px' }} />
                        )}
                      </div>
                    );

                    return n.link ? (
                      <Link key={n.id} to={n.link} style={{ textDecoration: 'none' }}>
                        {content}
                      </Link>
                    ) : content;
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
