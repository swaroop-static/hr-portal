import { useEffect, useState } from 'react';
import { getPositions, createPosition, updatePosition, deletePosition, getApplications, getRoundsByApplication, getManagerSummary } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

interface Position {
  id: string;
  title: string;
  description: string;
  department: string;
  vacancies: number;
  status: string;
  createdAt: string;
  _count: { applications: number };
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-700',
  CLOSED: 'bg-red-100 text-red-700',
  ON_HOLD: 'bg-yellow-100 text-yellow-700',
};

const roundStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  PASSED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

const appStatusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  SELECTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [allApplications, setAllApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Position | null>(null);
  const [form, setForm] = useState({ title: '', description: '', department: '', vacancies: 1, status: 'OPEN' });
  const [activeTab, setActiveTab] = useState<'positions' | 'candidates'>('positions');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [pos, apps, sum] = await Promise.all([getPositions(), getApplications(), getManagerSummary().catch(() => null)]);
      const myPositions = pos.filter((p: any) => p.managerId === user?.id);
      setPositions(myPositions);
      // Filter applications for manager's positions only
      const myPositionIds = new Set(myPositions.map((p: any) => p.id));
      setAllApplications(apps.filter((a: any) => myPositionIds.has(a.positionId)));
      setSummary(sum);
    } catch (e: any) {
      setError('Failed to load data. Please refresh.');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ title: '', description: '', department: '', vacancies: 1, status: 'OPEN' });
    setShowModal(true);
  };

  const openEdit = (p: Position) => {
    setEditTarget(p);
    setForm({ title: p.title, description: p.description, department: p.department, vacancies: p.vacancies, status: p.status });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editTarget) await updatePosition(editTarget.id, form);
      else await createPosition(form);
      setShowModal(false);
      load();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this position?')) return;
    try { await deletePosition(id); load(); } catch {}
  };

  const totalApps = positions.reduce((s, p) => s + p._count.applications, 0);
  const openCount = positions.filter(p => p.status === 'OPEN').length;
  const selectedCount = allApplications.filter(a => a.status === 'SELECTED').length;

  return (
    <div className="p-8">
      <div style={{background:'#dc2626',color:'#fff',padding:'12px 20px',borderRadius:8,marginBottom:16,fontWeight:700}}>
        DEBUG: Manager component loaded. User: {user?.name} | Role: {user?.role} | Loading: {String(loading)} | Error: {error || 'none'}
      </div>
      {error && (
        <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your job openings and track all candidates</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold shadow-md hover:opacity-90 transition-all" style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5a9e)' }}>
          + New Position
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5 mb-4">
        {[
          { label: 'Total Positions', value: summary?.totalPositions ?? positions.length, color: 'from-blue-500 to-blue-600' },
          { label: 'Open Positions', value: summary?.openPositions ?? openCount, color: 'from-green-500 to-green-600' },
          { label: 'Total Candidates', value: summary?.totalApplications ?? totalApps, color: 'from-violet-500 to-violet-600' },
          { label: 'Selected', value: summary?.pipeline?.selected ?? selectedCount, color: 'from-emerald-500 to-emerald-600' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-5 text-white shadow-lg`}>
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-white/80 text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pipeline breakdown */}
      {summary && (
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Pending', value: summary.pipeline?.pending ?? 0, color: 'from-yellow-400 to-yellow-500' },
            { label: 'In Progress', value: summary.pipeline?.inProgress ?? 0, color: 'from-blue-400 to-blue-500' },
            { label: 'Selected', value: summary.pipeline?.selected ?? 0, color: 'from-green-400 to-green-500' },
            { label: 'Rejected', value: summary.pipeline?.rejected ?? 0, color: 'from-red-400 to-red-500' },
            { label: 'Total Rounds', value: summary.totalRounds ?? 0, color: 'from-purple-400 to-purple-500' },
          ].map(s => (
            <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-xl p-4 text-white shadow-md`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-white/80 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}
      {!summary && <div className="mb-8" />}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: 'positions', label: '💼 My Positions' },
          { key: 'candidates', label: '👥 All Candidates' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── POSITIONS TAB ── */}
      {activeTab === 'positions' && (
        loading ? <div className="text-center py-16 text-gray-400">Loading...</div>
        : positions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="text-4xl mb-3">💼</div>
            <p className="text-gray-500 font-medium">No positions yet</p>
            <button onClick={openCreate} className="mt-4 px-5 py-2 text-white rounded-lg text-sm font-semibold" style={{ background: '#1e3a5f' }}>Create Position</button>
          </div>
        ) : (
          <div className="grid gap-4">
            {positions.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 text-lg">{p.title}</h3>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[p.status]}`}>{p.status}</span>
                    </div>
                    <p className="text-gray-500 text-sm mb-3 line-clamp-2">{p.description}</p>
                    <div className="flex items-center gap-5 text-sm text-gray-400">
                      <span>🏢 {p.department}</span>
                      <span>🪑 {p.vacancies} {p.vacancies === 1 ? 'vacancy' : 'vacancies'}</span>
                      <span>👥 {p._count.applications} candidates</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => { setActiveTab('candidates'); }} className="px-4 py-2 text-sm font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-all">
                      View Candidates
                    </button>
                    <button onClick={() => openEdit(p)} className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all">Edit</button>
                    <button onClick={() => handleDelete(p.id)} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── CANDIDATES TAB ── */}
      {activeTab === 'candidates' && (
        loading ? <div className="text-center py-16 text-gray-400">Loading candidates...</div>
        : allApplications.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-gray-500">No candidates yet — HR will add them</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allApplications.map(app => (
              <div key={app.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Candidate row */}
                <button
                  onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                  className="w-full flex items-center px-5 py-4 hover:bg-gray-50 transition-all text-left">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold mr-4 flex-shrink-0">
                    {app.candidateName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm">{app.candidateName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{app.position?.title} · {app.candidateEmail}</div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${appStatusColors[app.status]}`}>
                      {app.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-400">{app._count?.rounds || 0} rounds</span>
                    <span className="text-gray-400 text-xs">{expandedApp === app.id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Expanded: rounds + scores + feedback */}
                {expandedApp === app.id && (
                  <RoundDetails applicationId={app.id} />
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editTarget ? 'Edit Position' : 'New Position'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Job Title</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="e.g. Senior React Developer" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Department</label>
                <input required value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="e.g. Engineering" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Vacancies</label>
                  <input type="number" min={1} value={form.vacancies} onChange={e => setForm({ ...form, vacancies: parseInt(e.target.value) })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white">
                    <option value="OPEN">Open</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-sm font-medium text-white rounded-xl" style={{ background: '#1e3a5f' }}>{editTarget ? 'Save Changes' : 'Create Position'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-component: loads and shows rounds for a candidate ──
function RoundDetails({ applicationId }: { applicationId: string }) {
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roundError, setRoundError] = useState<string | null>(null);

  useEffect(() => {
    getRoundsByApplication(applicationId)
      .then(setRounds)
      .catch(() => { setRoundError('Failed to load rounds.'); })
      .finally(() => setLoading(false));
  }, [applicationId]);

  if (loading) return <div className="px-5 py-4 text-sm text-gray-400 border-t border-gray-50">Loading rounds...</div>;
  if (rounds.length === 0) return <div className="px-5 py-4 text-sm text-gray-400 border-t border-gray-50">No rounds added yet</div>;

  return (
    <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50">
      {roundError && <div className="text-red-400 text-sm py-2">{roundError}</div>}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pipeline</p>
      {rounds.map((round: any, idx: number) => (
        <div key={round.id} className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-600 flex items-center justify-center flex-shrink-0">
                {idx + 1}
              </span>
              <span className="text-sm font-semibold text-gray-700">{round.type.replace(/_/g, ' ')}</span>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roundStatusColors[round.status] || 'bg-gray-100 text-gray-600'}`}>
              {round.status}
            </span>
          </div>

          <div className="pl-8 space-y-1">
            {/* Test score */}
            {round.testAttempt && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-500">Test Score:</span>
                <span className={`font-bold ${(round.testAttempt.score ?? 0) >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                  {round.testAttempt.score ?? 'N/A'}%
                </span>
                <span className="text-gray-400">({round.testAttempt.status})</span>
                {(round.testAttempt.tabSwitches ?? 0) > 0 && (
                  <span className="text-red-500">⚠️ {round.testAttempt.tabSwitches ?? 0} tab switch(es)</span>
                )}
              </div>
            )}

            {/* Interviewer */}
            {round.interviewer && (
              <div className="text-xs text-gray-500">
                Interviewer: <span className="font-medium text-gray-700">{round.interviewer.name}</span>
              </div>
            )}

            {/* Scheduled */}
            {round.scheduledAt && (
              <div className="text-xs text-gray-500">
                Scheduled: <span className="font-medium text-gray-700">{new Date(round.scheduledAt).toLocaleString()}</span>
              </div>
            )}

            {/* Interviewer feedback/notes */}
            {round.notes && (
              <div className="mt-2 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 text-xs text-gray-700 italic">
                💬 "{round.notes}"
              </div>
            )}

            {/* No data yet */}
            {!round.testAttempt && !round.interviewer && !round.notes && (
              <span className="text-xs text-gray-400">Waiting...</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
