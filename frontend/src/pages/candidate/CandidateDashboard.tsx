import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCandidateMyTest } from '../../api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { ClipboardList, CheckCircle, Calendar, Video, AlertTriangle } from 'lucide-react';

export default function CandidateDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { error: toastError } = useToast();
  const [activeTests, setActiveTests] = useState<any[]>([]);
  const [pastTests, setPastTests] = useState<any[]>([]);
  const [activeInterviews, setActiveInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCandidateMyTest()
      .then(data => {
        setActiveTests(data.activeTests || []);
        setPastTests(data.pastTests || []);
        setActiveInterviews(data.activeInterviews || []);
      })
      .catch(() => { toastError('Failed to load your tests. Please refresh.'); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-gray-700/50 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 border border-yellow-400/35 flex items-center justify-center relative">
            <div className="absolute top-[-1px] left-[-1px] w-[5px] h-[5px] border-t-[1.5px] border-l-[1.5px] border-yellow-400" />
            <div className="absolute bottom-[-1px] right-[-1px] w-[5px] h-[5px] border-b-[1.5px] border-r-[1.5px] border-yellow-400" />
            <span className="text-yellow-400 text-[10px] font-bold tracking-wide">HR</span>
          </div>
          <span className="text-white text-[13px] font-bold tracking-widest uppercase">Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Welcome, <strong className="text-white">{user?.name}</strong>
          </span>
          <button
            onClick={logout}
            className="text-xs text-gray-500 border border-gray-600 px-3.5 py-1.5 hover:text-red-400 transition-colors bg-transparent rounded"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-8 py-12 max-w-[600px] mx-auto w-full">
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            {/* Active tests */}
            {activeTests.length > 0 && (
              <div className="mb-12">
                <div className="mb-6 text-center">
                  <p className="text-xs font-semibold text-yellow-400 tracking-[0.15em] uppercase mb-2">Your Assessment</p>
                  <h2 className="text-[26px] font-bold text-white">Ready to begin?</h2>
                </div>

                {activeTests.map(item => (
                  <div key={item.attempt.id} className="bg-gray-800 border border-gray-700 p-7 mb-4 rounded-xl">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">
                          {item.round.test?.title}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {item.application.position?.title} · {item.application.position?.department}
                        </p>
                      </div>
                      <StatusBadge status={item.attempt.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'PENDING'} />
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                      {[
                        { label: 'Questions', value: item.round.test?.questions?.length || '—' },
                        { label: 'Duration', value: `${item.round.test?.duration} min` },
                        { label: 'Type', value: 'Secure Test' },
                      ].map(stat => (
                        <div key={stat.label} className="bg-gray-900 p-3 text-center rounded-lg">
                          <div className="text-xl font-bold text-white">{stat.value}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-start gap-2 bg-yellow-400/5 border border-yellow-400/15 px-4 py-3 mb-5 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-yellow-400/80 shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-400/80 leading-relaxed">
                        Once you start: switching tabs or exiting fullscreen will immediately terminate your test.
                        {item.attempt.proctorId && ' A monitor has been assigned to watch your session live.'}
                      </p>
                    </div>

                    <button
                      onClick={() => navigate(`/test/${item.attempt.token}`)}
                      className="w-full py-3.5 bg-yellow-400 text-black font-bold text-[13px] tracking-widest uppercase hover:bg-yellow-300 transition-colors rounded-lg"
                    >
                      {item.attempt.status === 'IN_PROGRESS' ? 'Continue Test →' : 'Start Test →'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Active interviews */}
            {activeInterviews.length > 0 && (
              <div className="mb-12">
                <div className="mb-5 text-center">
                  <p className="text-xs font-semibold text-yellow-400 tracking-[0.15em] uppercase mb-2">Interviews Scheduled</p>
                </div>
                {activeInterviews.map(item => {
                  const typeLabel: Record<string, string> = { TECHNICAL_INTERVIEW: 'Technical Interview', HR_INTERVIEW: 'HR Interview', FINAL_INTERVIEW: 'Final Interview' };
                  return (
                    <div key={item.round.id} className="bg-gray-800 border border-gray-700 p-6 mb-3 rounded-xl">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-base font-bold text-white mb-1">
                            {typeLabel[item.round.type] || item.round.type}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {item.application.position?.title} · {item.application.position?.department}
                          </p>
                          {item.round.interviewer && (
                            <p className="text-xs text-gray-500 mt-1">
                              Interviewer: {item.round.interviewer.name}
                            </p>
                          )}
                          {item.round.scheduledAt && (
                            <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(item.round.scheduledAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/interview/${item.round.id}/lobby`)}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold text-[13px] tracking-widest uppercase transition-colors rounded-lg flex items-center justify-center gap-2"
                      >
                        <Video className="w-4 h-4" />
                        Join Interview Call →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Nothing at all */}
            {activeTests.length === 0 && pastTests.length === 0 && activeInterviews.length === 0 && (
              <EmptyState
                icon={ClipboardList}
                title="No Active Tests"
                description="You don't have any tests assigned yet. HR will notify you when your test is ready."
              />
            )}

            {/* No active tasks but has past tests */}
            {activeTests.length === 0 && activeInterviews.length === 0 && pastTests.length > 0 && (
              <div className="flex items-center justify-center gap-2 mb-8 text-gray-400 text-sm">
                <CheckCircle className="w-4 h-4 text-green-400" />
                No active tests. See your results below.
              </div>
            )}

            {/* Past tests history */}
            {pastTests.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-yellow-400 tracking-[0.15em] uppercase mb-4">Test History</p>
                <div className="flex flex-col gap-3">
                  {pastTests.map(item => {
                    const passed = item.attempt.score !== null && item.attempt.score >= 60;
                    return (
                      <div key={item.attempt.id} className="bg-gray-800 border border-gray-700/50 p-5 rounded-xl">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-[15px] font-bold text-white mb-0.5">
                              {item.round.test?.title}
                            </h3>
                            <p className="text-xs text-gray-400">
                              {item.application.position?.title} · {item.application.position?.department}
                            </p>
                          </div>
                          <StatusBadge status={item.attempt.status} />
                        </div>

                        <div className="flex gap-5 flex-wrap">
                          {item.attempt.score !== null && (
                            <div>
                              <div className="text-[10px] text-gray-500 mb-0.5">Score</div>
                              <div className={`text-[22px] font-bold ${passed ? 'text-green-400' : 'text-red-400'}`}>
                                {item.attempt.score}%
                              </div>
                              <div className={`text-[10px] ${passed ? 'text-green-400' : 'text-red-400'}`}>{passed ? 'Passed' : 'Did not pass'}</div>
                            </div>
                          )}
                          {item.attempt.submittedAt && (
                            <div>
                              <div className="text-[10px] text-gray-500 mb-0.5">Submitted</div>
                              <div className="text-sm text-gray-400">
                                {new Date(item.attempt.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            </div>
                          )}
                          {item.attempt.score === null && item.attempt.status === 'SUBMITTED' && (
                            <div>
                              <div className="text-[10px] text-gray-500 mb-0.5">Score</div>
                              <div className="text-sm text-gray-400 italic">Pending manual review</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
