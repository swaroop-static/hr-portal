import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCodeSnapshots } from '../api';

interface RunOutput {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

interface CodeSnapshot {
  id: string;
  createdAt: string;
  code: string;
  language: string;
  savedBy?: string; // 'CANDIDATE' | 'INTERVIEWER' | string
  runOutput?: string | RunOutput; // may be stored as JSON string
}

function relativeTime(ts: string): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function parseRunOutput(raw: string | RunOutput | undefined): RunOutput | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return { stdout: String(raw) }; }
}

const langColors: Record<string, string> = {
  javascript: 'bg-yellow-900 text-yellow-300 border-yellow-700',
  python: 'bg-blue-900 text-blue-300 border-blue-700',
};

export default function CodeReplayPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();

  const [snapshots, setSnapshots] = useState<CodeSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!roundId) return;
    setLoading(true);
    getCodeSnapshots(roundId)
      .then((data: CodeSnapshot[]) => {
        setSnapshots(data);
        setSelectedIdx(0);
        setError(null);
      })
      .catch((e: any) => {
        setError(e?.response?.data?.error || 'Failed to load code snapshots.');
      })
      .finally(() => setLoading(false));
  }, [roundId]);

  const selected = snapshots[selectedIdx] || null;
  const runOutput = selected ? parseRunOutput(selected.runOutput) : null;

  const goBack = () => navigate(-1);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
            <polyline points="15,18 9,12 15,6" />
          </svg>
          Back
        </button>
        <div className="w-px h-5 bg-gray-700" />
        <h1 className="text-white font-semibold">Code Replay</h1>
        {roundId && <span className="text-xs font-mono text-gray-500">Round {roundId.slice(0, 8)}...</span>}
        {!loading && snapshots.length > 0 && (
          <span className="text-xs text-gray-500">{snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}</span>
        )}
        {roundId && (
          <Link
            to={`/interview/${roundId}/timeline`}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-700 rounded-lg hover:bg-yellow-500/20 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            View Timeline
          </Link>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Loading code snapshots...
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-red-900 border border-red-700 text-red-300 px-6 py-4 rounded-xl text-sm max-w-md text-center">
            {error}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && snapshots.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4">💾</div>
            <p className="text-gray-300 font-medium text-lg">No code snapshots recorded</p>
            <p className="text-gray-500 text-sm mt-2">No code snapshots recorded for this interview.</p>
            <button
              onClick={goBack}
              className="mt-6 px-5 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl transition-colors"
            >
              ← Go Back
            </button>
          </div>
        </div>
      )}

      {/* Main content: timeline + viewer */}
      {!loading && !error && snapshots.length > 0 && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel — timeline */}
          <div className="w-72 flex-shrink-0 border-r border-gray-700 bg-gray-800 overflow-y-auto">
            <div className="p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Timeline</p>
              <div className="space-y-2">
                {snapshots.map((snap, idx) => {
                  const isSelected = idx === selectedIdx;
                  const runOut = parseRunOutput(snap.runOutput);
                  return (
                    <button
                      key={snap.id}
                      onClick={() => setSelectedIdx(idx)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-yellow-900/30 border-yellow-700'
                          : 'bg-gray-900/40 border-gray-700 hover:border-gray-600 hover:bg-gray-700/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-mono text-gray-400">{relativeTime(snap.createdAt)}</span>
                        {snap.language && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${langColors[snap.language.toLowerCase()] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                            {snap.language}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${isSelected ? 'text-yellow-300' : 'text-gray-300'}`}>
                          {snap.savedBy === 'CANDIDATE' ? 'Candidate' : snap.savedBy === 'INTERVIEWER' ? 'Interviewer' : snap.savedBy || 'Unknown'}
                        </span>
                        {runOut && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            runOut.exitCode === 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                          }`}>
                            {runOut.exitCode === 0 ? 'Ran ✓' : 'Ran ✗'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right panel — selected snapshot */}
          <div className="flex-1 overflow-y-auto p-6">
            {selected && (
              <>
                {/* Snapshot metadata */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    {selected.language && (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded border ${langColors[selected.language.toLowerCase()] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                        {selected.language.charAt(0).toUpperCase() + selected.language.slice(1)}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-mono">{new Date(selected.createdAt).toLocaleString()}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    Saved by: <span className="text-gray-300 font-medium">{selected.savedBy === 'CANDIDATE' ? 'Candidate' : selected.savedBy === 'INTERVIEWER' ? 'Interviewer' : selected.savedBy || 'Unknown'}</span>
                  </span>
                  {/* Navigation */}
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => setSelectedIdx(i => Math.max(0, i - 1))}
                      disabled={selectedIdx === 0}
                      className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs text-gray-500">{selectedIdx + 1} / {snapshots.length}</span>
                    <button
                      onClick={() => setSelectedIdx(i => Math.min(snapshots.length - 1, i + 1))}
                      disabled={selectedIdx === snapshots.length - 1}
                      className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                </div>

                {/* Code display */}
                <div className="bg-gray-950 border border-gray-700 rounded-xl overflow-hidden mb-4">
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <span className="text-xs font-medium text-gray-400">Code</span>
                    <span className="text-xs text-gray-600 font-mono">{selected.code?.length ?? 0} chars</span>
                  </div>
                  <pre
                    className="p-4 text-sm text-gray-200 overflow-x-auto whitespace-pre font-mono leading-relaxed"
                    style={{ fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, monospace', minHeight: 120, maxHeight: 480 }}
                  >
                    {selected.code || '(empty)'}
                  </pre>
                </div>

                {/* Run output */}
                {runOutput && (
                  <div className="bg-gray-950 border border-gray-700 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700">
                      <span className="text-xs font-medium text-gray-400">Run Output</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        runOutput.exitCode === 0 ? 'bg-green-900/60 text-green-400' : 'bg-red-900/60 text-red-400'
                      }`}>
                        Exit {runOutput.exitCode ?? '?'}
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      {runOutput.stdout && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1.5">stdout</p>
                          <pre className="text-sm text-green-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
                            {runOutput.stdout}
                          </pre>
                        </div>
                      )}
                      {runOutput.stderr && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1.5">stderr</p>
                          <pre className="text-sm text-red-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
                            {runOutput.stderr}
                          </pre>
                        </div>
                      )}
                      {!runOutput.stdout && !runOutput.stderr && (
                        <p className="text-gray-500 text-sm italic">(no output)</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
