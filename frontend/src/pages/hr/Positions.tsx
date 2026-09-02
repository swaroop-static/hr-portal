import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPositions } from '../../api';

interface Position {
  id: string;
  title: string;
  department: string;
  vacancies: number;
  status: string;
  createdAt: string;
  manager: { name: string };
  _count: { applications: number };
}

const statusColors: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-700',
  CLOSED: 'bg-red-100 text-red-700',
  ON_HOLD: 'bg-yellow-100 text-yellow-700',
};

export default function Positions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPositions()
      .then(setPositions)
      .catch(() => { setError('Failed to load data. Please refresh.'); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? positions : positions.filter(p => p.status === filter);

  return (
    <div className="p-8">
      {error && (
        <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Positions</h1>
          <p className="text-gray-500 text-sm mt-1">All positions created by managers</p>
        </div>
        <div className="flex gap-2">
          {['ALL', 'OPEN', 'ON_HOLD', 'CLOSED'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === s ? 'text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              style={filter === s ? { background: '#1e3a5f' } : {}}>
              {s === 'ALL' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="text-4xl mb-3">💼</div>
          <p className="text-gray-500">No positions found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Position</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Manager</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vacancies</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Applications</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-all">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900 text-sm">{p.title}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.department}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.manager?.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.vacancies}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p._count.applications}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[p.status]}`}>{p.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/hr/applications?positionId=${p.id}`} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View Candidates →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
