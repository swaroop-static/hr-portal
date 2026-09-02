import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Users, Clock, ClipboardList, Plus, FileText } from 'lucide-react';
import { getPositions, getApplications, getTests } from '../../api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/ui/StatusBadge';
import { SkeletonCard } from '../../components/ui/Skeleton';

export default function HRDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ positions: 0, applications: 0, tests: 0, pending: 0 });
  const [recentApps, setRecentApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [positions, applications, tests] = await Promise.all([
          getPositions(), getApplications(), getTests()
        ]);
        const pending = applications.filter((a: any) => a.status === 'PENDING').length;
        setStats({ positions: positions.length, applications: applications.length, tests: tests.length, pending });
        setRecentApps(applications.slice(0, 5));
      } catch {
        setError('Failed to load data. Please refresh.');
      }
      setLoading(false);
    })();
  }, []);

  const statCards = [
    { label: 'Open Positions', key: 'positions' as const, Icon: Briefcase, link: '/hr/positions', accent: 'text-blue-400', border: 'border-blue-400/20' },
    { label: 'Total Candidates', key: 'applications' as const, Icon: Users, link: '/hr/applications', accent: 'text-violet-400', border: 'border-violet-400/20' },
    { label: 'Pending Review', key: 'pending' as const, Icon: Clock, link: '/hr/applications', accent: 'text-yellow-400', border: 'border-yellow-400/20' },
    { label: 'Tests Created', key: 'tests' as const, Icon: ClipboardList, link: '/hr/tests', accent: 'text-emerald-400', border: 'border-emerald-400/20' },
  ];

  const quickActions = [
    { label: 'Add Candidate', Icon: Plus, link: '/hr/applications', desc: 'Register a new applicant' },
    { label: 'Create Test', Icon: FileText, link: '/hr/tests', desc: 'Build a new assessment' },
    { label: 'View Positions', Icon: Briefcase, link: '/hr/positions', desc: 'See all job openings' },
  ];

  return (
    <div className="p-8 min-h-screen bg-gray-900">
      {error && (
        <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Welcome back, {user?.name}</h1>
        <p className="text-gray-400 text-sm mt-1">Here's what's happening across your recruitment pipeline</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {statCards.map(({ label, key, Icon, link, accent, border }) => (
          <Link
            key={label}
            to={link}
            className={`bg-gray-800 border ${border} rounded-2xl p-5 hover:border-opacity-60 hover:scale-[1.02] transition-all`}
          >
            {loading ? (
              <SkeletonCard />
            ) : (
              <>
                <Icon className={`w-6 h-6 ${accent} mb-3`} />
                <div className="text-3xl font-bold text-white">{stats[key]}</div>
                <div className="text-gray-400 text-sm mt-1">{label}</div>
              </>
            )}
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {quickActions.map(({ label, Icon, link, desc }) => (
          <Link
            key={label}
            to={link}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-5 flex items-center gap-4 hover:border-gray-600 hover:bg-gray-700/50 transition-all group"
          >
            <div className="w-12 h-12 bg-yellow-400/10 border border-yellow-400/20 rounded-xl flex items-center justify-center group-hover:bg-yellow-400/20 transition-colors">
              <Icon className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">{label}</div>
              <div className="text-gray-400 text-xs mt-0.5">{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent applications */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-white">Recent Applications</h2>
          <Link to="/hr/applications" className="text-sm text-yellow-400 hover:text-yellow-300 font-medium transition-colors">View all →</Link>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-gray-400">Loading...</div>
        ) : recentApps.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400">No applications yet</div>
        ) : (
          <div className="divide-y divide-gray-700">
            {recentApps.map(app => (
              <Link
                key={app.id}
                to={`/hr/applications/${app.id}`}
                className="flex items-center px-6 py-4 hover:bg-gray-700/50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold mr-4 flex-shrink-0">
                  {app.candidateName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm">{app.candidateName}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{app.position?.title} · {app.candidateEmail}</div>
                </div>
                <StatusBadge status={app.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
