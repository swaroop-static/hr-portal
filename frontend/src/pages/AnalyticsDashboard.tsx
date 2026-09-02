import { useState, useEffect, useCallback } from 'react';
import {
  getAnalyticsSummary,
  getAnalyticsFunnel,
  getAnalyticsRoundsByType,
  getAnalyticsRecentActivity,
  getAnalyticsInterviewerStats,
} from '../api';
import StatusBadge from '../components/ui/StatusBadge';
import { SkeletonCard, SkeletonTable } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';

interface Summary {
  totalApplications: number;
  openPositions: number;
  totalRounds: number;
  avgTestScore: number;
  selectedCount: number;
  rejectedCount: number;
  pendingCount: number;
}

interface FunnelItem {
  status: string;
  count: number;
}

interface RoundTypeItem {
  type: string;
  count: number;
}

interface RecentActivity {
  id: string;
  candidateName: string;
  position: { title: string };
  status: string;
  createdAt: string;
}

interface InterviewerStat {
  id: string;
  name: string;
  total: number;
  completed: number;
  pending: number;
}

const statusColors: Record<string, string> = {
  PENDING: '#FACC15',
  IN_PROGRESS: '#60A5FA',
  SELECTED: '#4ADE80',
  REJECTED: '#F87171',
};

const roundTypeColors: Record<string, string> = {
  TECHNICAL_INTERVIEW: '#818CF8',
  HR_INTERVIEW: '#34D399',
  FINAL_INTERVIEW: '#FACC15',
  TEST: '#F472B6',
};

function SummaryCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{
      background: 'var(--obsidian-2, #161b22)',
      border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
      borderRadius: '10px',
      padding: '22px 24px',
      flex: '1 1 0',
      minWidth: '160px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: accent ? 'linear-gradient(90deg, var(--gold,#C9A84C) 0%, transparent 100%)' : 'linear-gradient(90deg, rgba(129,140,248,0.6) 0%, transparent 100%)', opacity: 0.7 }} />
      <div style={{ fontSize: '11px', color: 'var(--text-dim, #64748b)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '10px' }}>{label}</div>
      <div style={{ fontSize: '32px', fontWeight: 700, color: accent ? 'var(--gold,#C9A84C)' : 'var(--text-primary, #e2e8f0)', fontFamily: 'var(--font-display, monospace)', lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function HBarChart({ data, colorMap }: { data: { label: string; value: number }[]; colorMap?: Record<string, string> }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {data.map(({ label, value }) => {
        const pct = (value / max) * 100;
        const color = colorMap?.[label] || 'var(--gold,#C9A84C)';
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '130px', fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', textAlign: 'right', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label.replace(/_/g, ' ')}
            </div>
            <div style={{ flex: 1, height: '22px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                background: color,
                opacity: 0.85,
                borderRadius: '4px',
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ width: '28px', fontSize: '13px', color: 'var(--text-primary, #e2e8f0)', fontWeight: 700, flexShrink: 0 }}>{value}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [funnel, setFunnel] = useState<FunnelItem[]>([]);
  const [roundsByType, setRoundsByType] = useState<RoundTypeItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [interviewerStats, setInterviewerStats] = useState<InterviewerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, f, r, a, i] = await Promise.all([
        getAnalyticsSummary(),
        getAnalyticsFunnel(),
        getAnalyticsRoundsByType(),
        getAnalyticsRecentActivity(),
        getAnalyticsInterviewerStats(),
      ]);
      setSummary(s);
      setFunnel(f);
      setRoundsByType(r);
      setRecentActivity(a);
      setInterviewerStats(i);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to load analytics data.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const cardStyle: React.CSSProperties = {
    background: 'var(--obsidian-2, #161b22)',
    border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
    borderRadius: '10px',
    padding: '24px',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text-primary, #e2e8f0)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '20px',
  };

  return (
    <div style={{ padding: '32px', minHeight: '100vh', background: 'var(--obsidian, #0f1117)', fontFamily: 'var(--font-body, system-ui)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-primary, #e2e8f0)', fontFamily: 'var(--font-display, system-ui)' }}>
            Analytics Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-dim, #64748b)' }}>
            Recruitment pipeline overview and performance metrics
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 18px', borderRadius: '6px', border: '1px solid var(--gold,#C9A84C)',
            background: 'transparent', color: 'var(--gold,#C9A84C)', fontSize: '13px',
            fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, transition: 'all 0.15s ease',
            fontFamily: 'var(--font-body, system-ui)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '14px 18px', marginBottom: '24px', color: '#f87171', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 0', minWidth: '160px' }}><SkeletonCard /></div>
            <div style={{ flex: '1 1 0', minWidth: '160px' }}><SkeletonCard /></div>
            <div style={{ flex: '1 1 0', minWidth: '160px' }}><SkeletonCard /></div>
            <div style={{ flex: '1 1 0', minWidth: '160px' }}><SkeletonCard /></div>
          </div>
          <div style={cardStyle}>
            <SkeletonTable rows={5} />
          </div>
        </>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <SummaryCard label="Total Applications" value={summary?.totalApplications ?? 0} accent />
            <SummaryCard label="Open Positions" value={summary?.openPositions ?? 0} />
            <SummaryCard label="Active Rounds" value={summary?.totalRounds ?? 0} />
            <SummaryCard label="Avg Test Score" value={summary ? `${summary.avgTestScore.toFixed(1)}%` : '—'} />
          </div>

          {/* Status breakdown quick stats */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {(['SELECTED', 'REJECTED', 'PENDING'] as const).map(s => (
              <div key={s} style={{
                flex: '1 1 0', minWidth: '120px',
                background: 'var(--obsidian-2,#161b22)',
                border: `1px solid ${statusColors[s]}30`,
                borderRadius: '8px', padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColors[s], flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim,#64748b)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{s}</div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: statusColors[s], fontFamily: 'var(--font-display,monospace)' }}>
                    {s === 'SELECTED' ? summary?.selectedCount : s === 'REJECTED' ? summary?.rejectedCount : summary?.pendingCount}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* Funnel */}
            <div style={cardStyle}>
              <div style={sectionTitle}>Application Funnel</div>
              {funnel.length === 0 ? (
                <p style={{ color: 'var(--text-dim,#64748b)', fontSize: '13px', margin: 0 }}>No data available.</p>
              ) : (
                <HBarChart
                  data={funnel.map(f => ({ label: f.status, value: f.count }))}
                  colorMap={statusColors}
                />
              )}
            </div>

            {/* Rounds by type */}
            <div style={cardStyle}>
              <div style={sectionTitle}>Rounds by Type</div>
              {roundsByType.length === 0 ? (
                <p style={{ color: 'var(--text-dim,#64748b)', fontSize: '13px', margin: 0 }}>No data available.</p>
              ) : (
                <HBarChart
                  data={roundsByType.map(r => ({ label: r.type, value: r.count }))}
                  colorMap={roundTypeColors}
                />
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ ...cardStyle, marginBottom: '24px' }}>
            <div style={sectionTitle}>Recent Activity</div>
            {recentActivity.length === 0 ? (
              <p style={{ color: 'var(--text-dim,#64748b)', fontSize: '13px', margin: 0 }}>No recent activity.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Candidate', 'Position', 'Status', 'Date'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim,#64748b)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 12px 12px 0', borderBottom: '1px solid var(--border-subtle,rgba(255,255,255,0.08))' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle,rgba(255,255,255,0.05))' }}>
                      <td style={{ padding: '12px 12px 12px 0', fontSize: '13px', color: 'var(--text-primary,#e2e8f0)', fontWeight: 500 }}>{row.candidateName}</td>
                      <td style={{ padding: '12px 12px 12px 0', fontSize: '13px', color: 'var(--text-secondary,#94a3b8)' }}>{row.position?.title || '—'}</td>
                      <td style={{ padding: '12px 12px 12px 0' }}><StatusBadge status={row.status} /></td>
                      <td style={{ padding: '12px 0 12px 0', fontSize: '12px', color: 'var(--text-dim,#64748b)' }}>
                        {new Date(row.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Interviewer Stats */}
          <div style={cardStyle}>
            <div style={sectionTitle}>Interviewer Performance</div>
            {interviewerStats.length === 0 ? (
              <p style={{ color: 'var(--text-dim,#64748b)', fontSize: '13px', margin: 0 }}>No interviewer data available.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Interviewer', 'Total Rounds', 'Completed', 'Completion Rate'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim,#64748b)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 12px 12px 0', borderBottom: '1px solid var(--border-subtle,rgba(255,255,255,0.08))' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {interviewerStats.map(row => {
                    const rate = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle,rgba(255,255,255,0.05))' }}>
                        <td style={{ padding: '12px 12px 12px 0', fontSize: '13px', color: 'var(--text-primary,#e2e8f0)', fontWeight: 500 }}>{row.name}</td>
                        <td style={{ padding: '12px 12px 12px 0', fontSize: '13px', color: 'var(--text-secondary,#94a3b8)' }}>{row.total}</td>
                        <td style={{ padding: '12px 12px 12px 0', fontSize: '13px', color: 'var(--text-secondary,#94a3b8)' }}>{row.completed}</td>
                        <td style={{ padding: '12px 0 12px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ flex: 1, maxWidth: '120px', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${rate}%`, height: '100%', background: rate >= 70 ? '#4ADE80' : rate >= 40 ? '#FACC15' : '#F87171', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                            </div>
                            <span style={{ fontSize: '12px', color: rate >= 70 ? '#4ADE80' : rate >= 40 ? '#FACC15' : '#F87171', fontWeight: 700 }}>{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
