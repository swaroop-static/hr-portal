import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, AlertCircle, Users, TrendingUp, RefreshCw, ArrowRight } from 'lucide-react';
import { getCommandCenter } from '../../api';
import StatusBadge from '../../components/ui/StatusBadge';

interface CommandCenterData {
  todayInterviews: {
    id: string; type: string; status: string; scheduledAt: string;
    candidateName: string; positionTitle: string; applicationId: string; interviewerName?: string;
  }[];
  pendingReviews: {
    id: string; type: string; status: string;
    candidateName: string; positionTitle: string; applicationId: string; interviewerName?: string;
  }[];
  pipeline: { pending: number; inProgress: number; selected: number; rejected: number };
  recentApplications: {
    id: string; candidateName: string; positionTitle: string; status: string; createdAt: string;
  }[];
}

const ROUND_LABELS: Record<string, string> = {
  TECHNICAL_INTERVIEW: 'Technical',
  HR_INTERVIEW: 'HR',
  FINAL_INTERVIEW: 'Final',
  TEST: 'Test',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommandCenter() {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const d = await getCommandCenter();
      setData(d);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const pipelineTotal = data ? data.pipeline.pending + data.pipeline.inProgress + data.pipeline.selected + data.pipeline.rejected : 0;

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-gray-400 text-sm mt-1">Live hiring operations — refreshes every 60s</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Last updated {lastRefresh.toLocaleTimeString()}</span>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 border border-gray-700 hover:border-yellow-400/50 hover:text-yellow-400 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Pipeline KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Pending Review', value: data?.pipeline.pending ?? '—', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
          { label: 'In Progress', value: data?.pipeline.inProgress ?? '—', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
          { label: 'Selected', value: data?.pipeline.selected ?? '—', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
          { label: 'Rejected', value: data?.pipeline.rejected ?? '—', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.bg} border rounded-lg p-4`}>
            <div className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</div>
            <div className="text-gray-400 text-sm mt-1">{kpi.label}</div>
            {data && pipelineTotal > 0 && typeof kpi.value === 'number' && (
              <div className="mt-2 bg-gray-700 rounded-full h-1">
                <div
                  className="rounded-full h-1 transition-all"
                  style={{ width: `${Math.round((kpi.value / pipelineTotal) * 100)}%`, background: 'currentColor' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Today's Interviews */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-white">Today's Interviews</span>
              {data && (
                <span className="bg-yellow-400/20 text-yellow-400 text-xs font-bold px-1.5 py-0.5 rounded">
                  {data.todayInterviews.length}
                </span>
              )}
            </div>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          ) : !data || data.todayInterviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Calendar className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No interviews scheduled today</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/60">
              {data.todayInterviews.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-700/30 transition-colors">
                  <div className="flex-shrink-0 text-center">
                    <div className="text-xs font-bold text-yellow-400">{formatTime(r.scheduledAt)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{r.candidateName}</div>
                    <div className="text-xs text-gray-400 truncate">{r.positionTitle} · {ROUND_LABELS[r.type]}</div>
                    {r.interviewerName && <div className="text-xs text-gray-500">with {r.interviewerName}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={r.status} />
                    <Link to={`/interview/${r.id}`} className="text-gray-400 hover:text-yellow-400 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Reviews */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold text-white">Pending Reviews</span>
              {data && data.pendingReviews.length > 0 && (
                <span className="bg-orange-400/20 text-orange-400 text-xs font-bold px-1.5 py-0.5 rounded">
                  {data.pendingReviews.length}
                </span>
              )}
            </div>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          ) : !data || data.pendingReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No pending reviews</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/60">
              {data.pendingReviews.map(r => (
                <Link key={r.id} to={`/hr/applications/${r.applicationId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-700/30 transition-colors no-underline">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{r.candidateName}</div>
                    <div className="text-xs text-gray-400 truncate">{r.positionTitle} · {ROUND_LABELS[r.type]}</div>
                    {r.interviewerName && <div className="text-xs text-gray-500">Interviewer: {r.interviewerName}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={r.status} />
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Applications */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Recent Applications</span>
            </div>
            <Link to="/hr/applications" className="text-xs text-yellow-400 hover:underline">View all →</Link>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          ) : !data || data.recentApplications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Users className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No recent applications</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/60">
              {data.recentApplications.map(a => (
                <Link key={a.id} to={`/hr/applications/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-700/30 transition-colors no-underline">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-sm font-bold flex-shrink-0">
                    {a.candidateName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{a.candidateName}</div>
                    <div className="text-xs text-gray-400 truncate">{a.positionTitle}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={a.status} />
                    <span className="text-xs text-gray-500">{timeAgo(a.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline Health */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center px-5 py-4 border-b border-gray-700 gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-white">Pipeline Health</span>
          </div>
          <div className="p-5 space-y-4">
            {data ? (
              <>
                {[
                  { label: 'Pending', count: data.pipeline.pending, color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
                  { label: 'In Progress', count: data.pipeline.inProgress, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
                  { label: 'Selected', count: data.pipeline.selected, color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
                  { label: 'Rejected', count: data.pipeline.rejected, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{s.label}</span>
                      <span className="font-semibold" style={{ color: s.color }}>{s.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: pipelineTotal > 0 ? `${Math.round((s.count / pipelineTotal) * 100)}%` : '0%',
                          background: s.color
                        }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-700">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Total candidates</span>
                    <span className="text-white font-bold">{pipelineTotal}</span>
                  </div>
                  {pipelineTotal > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {Math.round((data.pipeline.selected / pipelineTotal) * 100)}% hire rate · {Math.round((data.pipeline.rejected / pipelineTotal) * 100)}% rejection rate
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-6 bg-gray-700 rounded animate-pulse" />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
