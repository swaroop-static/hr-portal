import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { getApplicationsPaginated, createApplication, getPositions, uploadResume } from '../../api';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';

interface Application {
  id: string;
  candidateName: string;
  candidateEmail: string;
  status: string;
  createdAt: string;
  position: { title: string; department: string };
  _count: { rounds: number };
}

export default function Applications() {
  const [searchParams] = useSearchParams();
  const positionId = searchParams.get('positionId') || '';

  const [applications, setApplications] = useState<Application[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [form, setForm] = useState({ candidateName: '', candidateEmail: '', positionId: positionId, candidatePassword: '' });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);

  const load = async (currentPage = page) => {
    setLoading(true);
    try {
      const [result, pos] = await Promise.all([
        getApplicationsPaginated(currentPage, 20, positionId || undefined),
        getPositions()
      ]);
      setApplications(result.data);
      setTotalPages(result.totalPages);
      setPositions(pos);
    } catch {
      setError('Failed to load data. Please refresh.');
    }
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
    load(1);
  }, [positionId]);

  useEffect(() => {
    // Skip on initial mount — positionId effect handles page=1 load
    if (page !== 1) load(page);
  }, [page]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createApplication(form);
      if (resumeFile) {
        try { await uploadResume(created.id, resumeFile); } catch {}
      }
      setShowModal(false);
      setResumeFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setCreatedCreds({ email: form.candidateEmail, password: form.candidatePassword });
      setForm({ candidateName: '', candidateEmail: '', positionId: '', candidatePassword: '' });
      setPage(1);
      load(1);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to add candidate. Please try again.');
    }
  };

  const filtered = applications.filter(a => {
    const matchSearch = a.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      a.candidateEmail.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const inputCls = 'bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:border-yellow-400 focus:outline-none rounded-xl px-4 py-2.5 text-sm w-full transition-colors';

  return (
    <div className="p-8 min-h-screen bg-gray-900">
      {error && (
        <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Candidates</h1>
          <p className="text-gray-400 text-sm mt-1">{applications.length} candidates on this page</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setForm({ candidateName: '', candidateEmail: '', positionId, candidatePassword: '' }); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-yellow-400 text-gray-900 rounded-xl text-sm font-semibold hover:bg-yellow-300 transition-colors"
        >
          + Add Candidate
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className={`flex-1 ${inputCls}`}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white focus:border-yellow-400 focus:outline-none rounded-xl px-4 py-2.5 text-sm transition-colors"
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="SELECTED">Selected</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <div ref={listRef}>
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading candidates...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No applications found"
            description="Try adjusting your filters or add a new candidate."
            action={{ label: 'Add Candidate', onClick: () => setShowModal(true) }}
          />
        ) : (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800/50 border-b border-gray-700">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Candidate</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Position</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Rounds</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Applied</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filtered.map(app => (
                  <tr key={app.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {app.candidateName[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{app.candidateName}</div>
                          <div className="text-xs text-gray-400">{app.candidateEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300">{app.position?.title}</div>
                      <div className="text-xs text-gray-400">{app.position?.department}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">{app._count.rounds} rounds</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">{new Date(app.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <Link to={`/hr/applications/${app.id}`} className="text-sm text-yellow-400 hover:text-yellow-300 font-medium transition-colors">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => { setPage(p => p - 1); listRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
            disabled={page <= 1}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page <span className="text-white font-semibold">{page}</span> of <span className="text-white font-semibold">{totalPages}</span>
          </span>
          <button
            onClick={() => { setPage(p => p + 1); listRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
            disabled={page >= totalPages}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Credentials popup after creating candidate */}
      {createdCreds && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-700 bg-green-900/20 rounded-t-2xl">
              <h2 className="text-lg font-bold text-white">Candidate Added</h2>
              <p className="text-sm text-gray-400 mt-1">Share these credentials with the candidate</p>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Login URL</span>
                  <span className="text-sm font-mono font-medium text-yellow-400">{window.location.origin}/login</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Email</span>
                  <span className="text-sm font-mono font-medium text-white">{createdCreds.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Password</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-yellow-400" id="cred-pw">{'•'.repeat(createdCreds.password.length)}</span>
                    <button type="button" className="text-xs text-gray-400 hover:text-gray-200 underline" onClick={() => {
                      const el = document.getElementById('cred-pw')!;
                      el.textContent = el.textContent?.includes('•') ? createdCreds!.password : '•'.repeat(createdCreds!.password.length);
                    }}>Show</button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500">The candidate will only see their assigned test after logging in. No access to any portal features.</p>
            </div>
            <div className="px-6 pb-5">
              <button onClick={() => setCreatedCreds(null)} className="w-full py-2.5 text-sm font-semibold bg-yellow-400 text-gray-900 rounded-xl hover:bg-yellow-300 transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white">Add New Candidate</h2>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Full Name</label>
                <input
                  required
                  value={form.candidateName}
                  onChange={e => setForm({ ...form, candidateName: e.target.value })}
                  className={inputCls}
                  placeholder="Candidate full name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={form.candidateEmail}
                  onChange={e => setForm({ ...form, candidateEmail: e.target.value })}
                  className={inputCls}
                  placeholder="candidate@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Position</label>
                <select
                  required
                  value={form.positionId}
                  onChange={e => setForm({ ...form, positionId: e.target.value })}
                  className="bg-gray-700 border border-gray-600 text-white focus:border-yellow-400 focus:outline-none rounded-xl px-4 py-2.5 text-sm w-full transition-colors"
                >
                  <option value="">Select position...</option>
                  {positions.map(p => <option key={p.id} value={p.id}>{p.title} — {p.department}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Login Password for Candidate</label>
                <input
                  required
                  type="text"
                  value={form.candidatePassword}
                  onChange={e => setForm({ ...form, candidatePassword: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Candidate@2024"
                />
                <p className="text-xs text-gray-500 mt-1">Share this with the candidate so they can log in to take the test</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Resume (PDF, optional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={e => setResumeFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-400/10 file:text-yellow-400 hover:file:bg-yellow-400/20 cursor-pointer"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-semibold text-gray-900 bg-yellow-400 hover:bg-yellow-300 rounded-xl transition-colors"
                >
                  Add Candidate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
