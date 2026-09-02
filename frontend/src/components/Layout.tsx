import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  ClipboardList,
  Eye,
  BarChart3,
  BookOpen,
  Layers,
  ScrollText,
  FileText,
  Shield,
  LogOut,
  MonitorPlay,
  LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  briefcase: Briefcase,
  users: Users,
  clipboard: ClipboardList,
  target: FileText,
  shield: Shield,
  logout: LogOut,
  chart: BarChart3,
  book: BookOpen,
  layers: Layers,
  log: ScrollText,
  eye: Eye,
  monitor: MonitorPlay,
};

const Icon = ({ name }: { name: string }) => {
  const LIcon = ICON_MAP[name];
  if (!LIcon) return null;
  return <LIcon className="w-5 h-5" />;
};

const navItems: Record<string, { label: string; path: string; icon: string }[]> = {
  ADMIN: [
    { label: 'User Management',  path: '/admin',                icon: 'shield' },
    { label: 'Command Center',   path: '/hr/command-center',   icon: 'monitor' },
    { label: 'Dashboard',        path: '/hr',                   icon: 'dashboard' },
    { label: 'Positions',        path: '/hr/positions',         icon: 'briefcase' },
    { label: 'Candidates',       path: '/hr/applications',      icon: 'users' },
    { label: 'Tests',            path: '/hr/tests',             icon: 'clipboard' },
    { label: 'Analytics',        path: '/hr/analytics',         icon: 'chart' },
    { label: 'Questions',        path: '/hr/questions',         icon: 'book' },
    { label: 'Templates',        path: '/hr/templates',         icon: 'layers' },
    { label: 'Audit Log',        path: '/admin/audit',          icon: 'log' },
  ],
  MANAGER: [
    { label: 'Dashboard', path: '/manager', icon: 'dashboard' },
  ],
  HR: [
    { label: 'Command Center', path: '/hr/command-center',  icon: 'monitor' },
    { label: 'Dashboard',      path: '/hr',                  icon: 'dashboard' },
    { label: 'Positions',      path: '/hr/positions',        icon: 'briefcase' },
    { label: 'Candidates',     path: '/hr/applications',     icon: 'users' },
    { label: 'Tests',          path: '/hr/tests',            icon: 'clipboard' },
    { label: 'Analytics',      path: '/hr/analytics',        icon: 'chart' },
    { label: 'Questions',      path: '/hr/questions',        icon: 'book' },
    { label: 'Templates',      path: '/hr/templates',        icon: 'layers' },
  ],
  INTERVIEWER: [
    { label: 'My Assignments', path: '/interviewer',              icon: 'target'    },
    { label: 'My Tests',       path: '/interviewer/tests',        icon: 'clipboard' },
    { label: 'Questions',      path: '/interviewer/questions',    icon: 'book'      },
    { label: 'Templates',      path: '/interviewer/templates',    icon: 'layers'    },
  ],
};

const roleLabel: Record<string, string> = {
  ADMIN: 'Administrator', MANAGER: 'Manager', HR: 'Human Resources', INTERVIEWER: 'Interviewer',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const items = user ? navItems[user.role] || [] : [];

  const isActive = (path: string) => {
    if (['/hr', '/manager', '/interviewer', '/admin'].includes(path)) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'var(--font-body)', background: 'var(--obsidian)' }}>
      <aside style={{ width: '220px', flexShrink: 0, background: 'var(--obsidian-2)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, var(--gold) 0%, transparent 100%)', opacity: 0.6 }} />

        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', border: '1px solid rgba(201,168,76,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: '6px', height: '6px', borderTop: '1.5px solid var(--gold)', borderLeft: '1.5px solid var(--gold)' }} />
              <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '6px', height: '6px', borderBottom: '1.5px solid var(--gold)', borderRight: '1.5px solid var(--gold)' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.04em' }}>HR</span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Portal</div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '1px', letterSpacing: '0.04em' }}>{roleLabel[user?.role || ''] || ''}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 10px 8px', margin: 0 }}>Navigation</p>
          {items.map(item => {
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', textDecoration: 'none', color: active ? 'var(--gold)' : 'var(--text-secondary)', background: active ? 'rgba(201,168,76,0.07)' : 'transparent', borderLeft: `2px solid ${active ? 'var(--gold)' : 'transparent'}`, fontSize: '13px', fontWeight: active ? 600 : 400, transition: 'all 0.15s ease' }}
                onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLAnchorElement; el.style.color = 'var(--text-primary)'; el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderLeftColor = 'rgba(201,168,76,0.3)'; } }}
                onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLAnchorElement; el.style.color = 'var(--text-secondary)'; el.style.background = 'transparent'; el.style.borderLeftColor = 'transparent'; } }}
              >
                <span style={{ opacity: active ? 1 : 0.6 }}><Icon name={item.icon} /></span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Notification bell */}
        <div style={{ padding: '4px 10px', borderTop: '1px solid var(--border-subtle)' }}>
          <NotificationBell />
        </div>

        {/* User footer */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 4px', marginBottom: '8px' }}>
            <div style={{ width: '30px', height: '30px', flexShrink: 0, background: 'linear-gradient(135deg, rgba(201,168,76,0.3), rgba(201,168,76,0.1))', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-display)' }}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>{user?.email}</div>
            </div>
          </div>
          <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '12px', fontFamily: 'var(--font-body)', fontWeight: 500, textAlign: 'left', transition: 'all 0.15s ease', borderLeft: '2px solid transparent' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.color = '#f87171'; el.style.background = 'rgba(239,68,68,0.05)'; el.style.borderLeftColor = 'rgba(239,68,68,0.4)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.color = 'var(--text-dim)'; el.style.background = 'transparent'; el.style.borderLeftColor = 'transparent'; }}>
            <Icon name="logout" />Sign out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', background: '#f0f4f8' }}>
        {children}
      </main>
    </div>
  );
}
