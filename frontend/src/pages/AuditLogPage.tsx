import { useEffect, useRef, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { getAuditLogs } from '../api';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

interface AuditEntry {
  id: string;
  createdAt: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: any;
  after?: any;
}

interface AuditResponse {
  logs: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
}

const ENTITY_TYPES = ['All', 'Application', 'Round', 'User', 'InterviewTemplate'];
const ACTIONS = [
  'All',
  'APPLICATION_STATUS_CHANGED',
  'ROUND_STATUS_CHANGED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DELETED',
  'TEMPLATE_CREATED',
  'TEMPLATE_APPLIED',
];
const PAGE_LIMIT = 20;

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${month} ${day}, ${year} ${hh}:${mm}`;
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ');
}

function DiffCell({ before, after }: { before?: any; after?: any }) {
  const [open, setOpen] = useState(false);

  if (!before && !after) return <span className="text-gray-600 text-xs">—</span>;

  const label = !before ? 'Created' : !after ? 'Deleted' : 'Changed';
  const labelColor = !before ? 'text-green-400' : !after ? 'text-red-400' : 'text-blue-400';

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`text-xs font-medium underline underline-offset-2 ${labelColor} hover:opacity-80`}
      >
        {label} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-2 space-y-2 max-w-xs">
          {before && (
            <div>
              <p className="text-xs font-semibold text-red-400 mb-1">Before</p>
              <pre className="text-xs bg-gray-900 border border-gray-700 rounded-lg p-2 overflow-x-auto text-red-300 whitespace-pre-wrap break-all">
                {typeof before === 'string' ? before : JSON.stringify(before, null, 2)}
              </pre>
            </div>
          )}
          {after && (
            <div>
              <p className="text-xs font-semibold text-green-400 mb-1">After</p>
              <pre className="text-xs bg-gray-900 border border-gray-700 rounded-lg p-2 overflow-x-auto text-green-300 whitespace-pre-wrap break-all">
                {typeof after === 'string' ? after : JSON.stringify(after, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('All');
  const [action, setAction] = useState('All');
  const [page, setPage] = useState(1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async (overrideSearch?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page,
        limit: PAGE_LIMIT,
      };
      const s = overrideSearch !== undefined ? overrideSearch : search;
      if (s.trim()) params.search = s.trim();
      if (entityType !== 'All') params.entityType = entityType;
      if (action !== 'All') params.action = action;

      const result = await getAuditLogs(params);
      setData(result);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load audit log.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, entityType, action]);

  // Debounce search
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(val);
    }, 300);
  };

  const handleFilterChange = (setter: (v: string) => void) => (val: string) => {
    setter(val);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-gray-400 text-sm mt-1">System-wide activity log for administrators.</p>
        </div>
        <button
          onClick={() => load()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
            <polyline points="23,4 23,10 17,10" />
            <polyline points="1,20 1,14 7,14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search by user, entity ID..."
          className="flex-1 min-w-48 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 text-sm"
        />
        <select
          value={entityType}
          onChange={e => handleFilterChange(setEntityType)(e.target.value)}
          className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-yellow-500"
        >
          {ENTITY_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All Entity Types' : t}</option>)}
        </select>
        <select
          value={action}
          onChange={e => handleFilterChange(setAction)(e.target.value)}
          className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-yellow-500"
        >
          {ACTIONS.map(a => <option key={a} value={a}>{a === 'All' ? 'All Actions' : formatAction(a)}</option>)}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
          <SkeletonTable rows={8} />
        </div>
      )}

      {/* Table */}
      {!loading && data && (
        <>
          {data.logs.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No audit events"
              description="Matching events will appear here."
            />
          ) : (
            <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Entity Type</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Entity ID</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {data.logs.map(entry => (
                      <tr key={entry.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-5 py-4 text-gray-300 whitespace-nowrap font-mono text-xs">
                          {formatTimestamp(entry.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-gray-200 text-xs">
                          {entry.userEmail || <span className="text-gray-500 italic">System</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-md bg-gray-700 text-yellow-400 whitespace-nowrap">
                            {formatAction(entry.action)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-300 text-xs">{entry.entityType}</td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-mono text-gray-400 break-all">
                            {entry.entityId ? entry.entityId.slice(0, 8) + '...' : '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <DiffCell before={entry.before} after={entry.after} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-700">
                <p className="text-xs text-gray-500">
                  Showing {((page - 1) * PAGE_LIMIT) + 1}–{Math.min(page * PAGE_LIMIT, data.total)} of {data.total} events
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    ← Previous
                  </button>
                  <span className="text-sm text-gray-400">
                    Page {page} of {data.totalPages || 1}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= (data.totalPages || 1)}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
