import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMyRounds, updateRound, getMyProctorSessions } from '../../api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import {
  Target, Clock, CheckCircle2, ClipboardList, Laptop, Handshake, Trophy,
  Star, Briefcase, FileText, Eye, Pencil, Video, Radio, MonitorPlay,
  ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';

const roundTypeLabel: Record<string, string> = {
  TEST: 'Test',
  TECHNICAL_INTERVIEW: 'Technical Interview',
  HR_INTERVIEW: 'HR Interview',
  FINAL_INTERVIEW: 'Final Interview',
};

const RoundTypeIcon = ({ type }: { type: string }) => {
  const cls = 'w-4 h-4';
  switch (type) {
    case 'TEST': return <ClipboardList className={cls} />;
    case 'TECHNICAL_INTERVIEW': return <Laptop className={cls} />;
    case 'HR_INTERVIEW': return <Handshake className={cls} />;
    case 'FINAL_INTERVIEW': return <Trophy className={cls} />;
    default: return <ClipboardList className={cls} />;
  }
};

type ReviewForm = {
  technicalSkills: number;
  problemSolving: number;
  communication: number;
  culturalFit: number;
  strengths: string;
  improvements: string;
  detailedFeedback: string;
  verdict: 'PASSED' | 'FAILED';
};

const defaultReview = (): ReviewForm => ({
  technicalSkills: 0,
  problemSolving: 0,
  communication: 0,
  culturalFit: 0,
  strengths: '',
  improvements: '',
  detailedFeedback: '',
  verdict: 'PASSED',
});

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400 w-36">{label}</span>
      <div className="flex gap-1 items-center">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} type="button"
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
            className="transition-transform hover:scale-110 focus:outline-none">
            <Star className={`w-5 h-5 ${star <= (hover || value) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`} />
          </button>
        ))}
        {value > 0 && (
          <span className="text-xs text-gray-500 ml-1 self-center">{value}/5</span>
        )}
      </div>
    </div>
  );
}

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`w-4 h-4 ${n <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`} />
      ))}
    </div>
  );
}

function parseNotes(notes: string | null) {
  if (!notes) return null;
  try { return JSON.parse(notes); } catch { return { detailedFeedback: notes }; }
}

export default function InterviewerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<any[]>([]);
  const [proctorSessions, setProctorSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<any>(null);
  const [form, setForm] = useState<ReviewForm>(defaultReview());
  const [updating, setUpdating] = useState(false);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getMyRounds(), getMyProctorSessions()])
      .then(([r, p]) => { setRounds(r); setProctorSessions(p); })
      .catch(() => setError('Failed to load data. Please refresh.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openReview = (round: any, verdict: 'PASSED' | 'FAILED') => {
    const existing = parseNotes(round.notes);
    setForm({
      technicalSkills: existing?.technicalSkills || 0,
      problemSolving: existing?.problemSolving || 0,
      communication: existing?.communication || 0,
      culturalFit: existing?.culturalFit || 0,
      strengths: existing?.strengths || '',
      improvements: existing?.improvements || '',
      detailedFeedback: existing?.detailedFeedback || '',
      verdict,
    });
    setReviewModal(round);
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModal) return;
    setUpdating(true);
    try {
      const notes = JSON.stringify({
        technicalSkills: form.technicalSkills,
        problemSolving: form.problemSolving,
        communication: form.communication,
        culturalFit: form.culturalFit,
        strengths: form.strengths,
        improvements: form.improvements,
        detailedFeedback: form.detailedFeedback,
      });
      await updateRound(reviewModal.id, { status: form.verdict, notes });
      setReviewModal(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to submit review.');
    }
    setUpdating(false);
  };

  const pending = rounds
    .filter(r => r.status === 'PENDING' || r.status === 'IN_PROGRESS')
    .sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt) return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      if (a.scheduledAt) return -1;
      if (b.scheduledAt) return 1;
      return 0;
    });

  const completed = rounds.filter(r => r.status === 'PASSED' || r.status === 'FAILED');

  const getTestAttemptForRound = (round: any) => {
    if (round?.testAttempt?.id) return round.testAttempt;
    if (round?.type !== 'TEST') return null;
    const nestedTestRound = round.application?.rounds?.find((r: any) => r?.type === 'TEST' && r?.testAttempt?.id);
    return nestedTestRound?.testAttempt || null;
  };

  const ratingAvg = (r: ReviewForm) => {
    const vals = [r.technicalSkills, r.problemSolving, r.communication, r.culturalFit].filter(v => v > 0);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 ml-4">✕</button>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Welcome, {user?.name}</h1>
        <p className="text-gray-400 text-sm mt-1">Your interview assignments and schedule</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {[
          {
            label: 'Total Assigned',
            value: rounds.length,
            icon: <Target className="w-5 h-5 text-yellow-400" />,
            iconBg: 'bg-yellow-400/10',
            text: 'text-white',
          },
          {
            label: 'Pending',
            value: pending.length,
            icon: <Clock className="w-5 h-5 text-blue-400" />,
            iconBg: 'bg-blue-400/10',
            text: 'text-white',
          },
          {
            label: 'Completed',
            value: completed.length,
            icon: <CheckCircle2 className="w-5 h-5 text-green-400" />,
            iconBg: 'bg-green-400/10',
            text: 'text-white',
          },
        ].map(s => (
          <div key={s.label} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${s.iconBg} rounded-lg flex items-center justify-center shrink-0`}>
              {s.icon}
            </div>
            <div>
              <div className={`text-2xl font-bold ${s.text}`}>{s.value}</div>
              <div className="text-gray-400 text-xs mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : rounds.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No interviews assigned yet"
          description="HR will assign candidates to you once applications are ready."
        />
      ) : (
        <div className="space-y-8">

          {/* Live Monitoring Sessions */}
          {proctorSessions.filter(s => s.status === 'IN_PROGRESS').length > 0 && (
            <section>
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full inline-block animate-pulse" />
                Live Tests — Monitor Now
              </h2>
              <div className="space-y-3">
                {proctorSessions.filter(s => s.status === 'IN_PROGRESS').map(session => (
                  <div key={session.id} className="bg-gray-800 border-2 border-red-500/40 rounded-xl p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-white">{session.round?.application?.candidateName}</span>
                          <StatusBadge status="IN_PROGRESS" />
                        </div>
                        <p className="text-sm text-gray-400">{session.round?.application?.candidateEmail}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400 flex-wrap">
                          <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {session.round?.application?.position?.title}</span>
                          <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {session.round?.test?.title}</span>
                          {session.tabSwitches > 0 && (
                            <span className="text-red-400 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> {session.tabSwitches} tab switch{session.tabSwitches > 1 ? 'es' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <Link to={`/hr/proctor/${session.id}`}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all flex-shrink-0">
                        <Radio className="w-4 h-4" /> Watch Live
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pending monitoring sessions (not started yet) */}
          {proctorSessions.filter(s => s.status === 'PENDING').length > 0 && (
            <section>
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full inline-block" />
                Assigned to Monitor (Not Started Yet)
              </h2>
              <div className="space-y-3">
                {proctorSessions.filter(s => s.status === 'PENDING').map(session => (
                  <div key={session.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="font-semibold text-white">{session.round?.application?.candidateName}</span>
                        <p className="text-sm text-gray-400 mt-0.5">{session.round?.application?.candidateEmail}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                          <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {session.round?.application?.position?.title}</span>
                          <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {session.round?.test?.title} ({session.round?.test?.duration} min)</span>
                        </div>
                      </div>
                      <Link to={`/hr/proctor/${session.id}`}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 border border-blue-400/30 rounded-xl transition-all flex-shrink-0">
                        <MonitorPlay className="w-4 h-4" /> Open Monitor
                      </Link>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Waiting for candidate to start the test</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pending Interviews */}
          {pending.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full inline-block" />
                My Interviews ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map(round => {
                  const now = new Date();
                  const scheduled = round.scheduledAt ? new Date(round.scheduledAt) : null;
                  const isFuture = scheduled && scheduled > now;
                  const diffHours = scheduled ? Math.round((scheduled.getTime() - now.getTime()) / 3600000) : null;
                  const testAttempt = getTestAttemptForRound(round);
                  return (
                    <div key={round.id} className={`bg-gray-800 rounded-xl overflow-hidden border ${isFuture ? 'border-purple-500/30' : 'border-gray-700'}`}>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-semibold text-white">{round.application?.candidateName}</span>
                              <StatusBadge status={round.status} />
                              {isFuture && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-400 border border-purple-500/30">
                                  Scheduled
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400">{round.application?.candidateEmail}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-400">
                              <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {round.application?.position?.title}</span>
                              <span className="flex items-center gap-1"><RoundTypeIcon type={round.type} /> {roundTypeLabel[round.type]}</span>
                              {scheduled && (
                                <span className={isFuture ? 'text-purple-400 font-medium' : 'text-gray-500'}>
                                  {scheduled.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                  {' '}{scheduled.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  {isFuture && diffHours !== null && (
                                    <span className="ml-1 text-purple-500">
                                      ({diffHours < 24 ? `in ${diffHours}h` : `in ${Math.round(diffHours / 24)}d`})
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                            {round.application?.rounds?.some((r: any) => r.testAttempt) && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {round.application.rounds.map((r: any) => r.testAttempt && (
                                  <span key={r.id} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${r.testAttempt.score >= 60 ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                                    Test: {r.testAttempt.score}%
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                            {round.type !== 'TEST' && (
                              <div className="flex flex-col gap-1 items-end">
                                <button onClick={() => navigate(`/interview/${round.id}`)}
                                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-black bg-yellow-400 hover:bg-yellow-300 rounded-xl transition-all">
                                  <Video className="w-4 h-4" /> Start Interview
                                </button>
                                <a href={`/interview/${round.id}/lobby`}
                                  className="text-xs text-yellow-400 hover:text-yellow-300 underline text-right">
                                  Tech Check
                                </a>
                              </div>
                            )}
                            {round.type !== 'TEST' && round.application?.resumePath && (
                              <a href={round.application.resumePath} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-purple-400 bg-purple-400/10 hover:bg-purple-400/20 border border-purple-400/30 rounded-xl transition-all">
                                <FileText className="w-4 h-4" /> Resume
                              </a>
                            )}
                            {round.type === 'TEST' && testAttempt?.status === 'IN_PROGRESS' && (
                              <Link to={`/hr/proctor/${testAttempt.id}`}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all">
                                <Radio className="w-4 h-4" /> Watch Live
                              </Link>
                            )}
                            {round.type === 'TEST' && testAttempt?.id && (
                              testAttempt?.status === 'SUBMITTED' || round.status === 'PASSED' || round.status === 'FAILED'
                            ) && (
                              <>
                                <Link to={`/tests/attempt/${testAttempt.id}/view`}
                                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 border border-blue-400/30 rounded-xl transition-all">
                                  <Eye className="w-4 h-4" /> View Responses
                                </Link>
                                <Link to={`/interviewer/attempt/${testAttempt.id}`}
                                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 border border-blue-400/30 rounded-xl transition-all">
                                  <Pencil className="w-4 h-4" /> Grade Test
                                </Link>
                              </>
                            )}
                            <button onClick={() => openReview(round, 'PASSED')}
                              className="px-4 py-2 text-sm font-semibold text-green-400 bg-green-400/10 hover:bg-green-400/20 border border-green-400/30 rounded-xl transition-all">
                              Pass
                            </button>
                            <button onClick={() => openReview(round, 'FAILED')}
                              className="px-4 py-2 text-sm font-semibold text-red-400 bg-red-400/10 hover:bg-red-400/20 border border-red-400/30 rounded-xl transition-all">
                              Fail
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Completed Interviews */}
          {completed.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-500 rounded-full inline-block" />
                Completed Interviews
              </h2>
              <div className="space-y-2">
                {completed.map(round => {
                  const parsed = parseNotes(round.notes);
                  const isExpanded = expandedRound === round.id;
                  const avg = parsed ? ratingAvg({ ...defaultReview(), ...parsed }) : null;
                  const testAttempt = getTestAttemptForRound(round);
                  return (
                    <div key={round.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                      <button onClick={() => setExpandedRound(isExpanded ? null : round.id)}
                        className="w-full text-left p-5 hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-semibold text-gray-200">{round.application?.candidateName}</span>
                            <StatusBadge status={round.status} />
                            {avg && (
                              <span className="flex items-center gap-1 text-xs text-yellow-400 font-medium">
                                <Star className="w-3.5 h-3.5 fill-yellow-400" /> {avg}/5 avg
                              </span>
                            )}
                            {round.type === 'TEST' && testAttempt?.id && (
                              testAttempt?.status === 'SUBMITTED' || round.status === 'PASSED' || round.status === 'FAILED'
                            ) && (
                              <>
                                <Link to={`/tests/attempt/${testAttempt.id}/view`}
                                  className="flex items-center gap-1 text-xs font-semibold text-green-400 hover:text-green-300 border border-green-400/30 bg-green-400/10 px-2.5 py-1 rounded-xl"
                                  onClick={e => e.stopPropagation()}>
                                  <Eye className="w-3 h-3" /> View Responses
                                </Link>
                                <Link to={`/interviewer/attempt/${testAttempt.id}`}
                                  className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 border border-blue-400/30 bg-blue-400/10 px-2.5 py-1 rounded-xl"
                                  onClick={e => e.stopPropagation()}>
                                  <Pencil className="w-3 h-3" /> Grade Test
                                </Link>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-400">
                            <span>{round.application?.position?.title}</span>
                            {round.completedAt && <span>{new Date(round.completedAt).toLocaleDateString()}</span>}
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-5 border-t border-gray-700">
                          {parsed ? (
                            <div className="mt-4 space-y-4">
                              {[parsed.technicalSkills, parsed.problemSolving, parsed.communication, parsed.culturalFit].some(v => v > 0) && (
                                <div className="grid grid-cols-2 gap-3">
                                  {[
                                    { label: 'Technical Skills', val: parsed.technicalSkills },
                                    { label: 'Problem Solving', val: parsed.problemSolving },
                                    { label: 'Communication', val: parsed.communication },
                                    { label: 'Cultural Fit', val: parsed.culturalFit },
                                  ].filter(x => x.val > 0).map(x => (
                                    <div key={x.label} className="bg-gray-900 rounded-xl p-3">
                                      <p className="text-xs text-gray-500 mb-1.5">{x.label}</p>
                                      <div className="flex items-center gap-1.5">
                                        <StarDisplay value={x.val} />
                                        <span className="text-xs text-gray-500 ml-1">{x.val}/5</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {parsed.strengths && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Strengths</p>
                                  <p className="text-sm text-gray-300 bg-green-900/20 rounded-xl px-4 py-2">{parsed.strengths}</p>
                                </div>
                              )}
                              {parsed.improvements && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Areas to Improve</p>
                                  <p className="text-sm text-gray-300 bg-yellow-900/20 rounded-xl px-4 py-2">{parsed.improvements}</p>
                                </div>
                              )}
                              {parsed.detailedFeedback && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Detailed Feedback</p>
                                  <p className="text-sm text-gray-300 bg-gray-900 rounded-xl px-4 py-2 whitespace-pre-wrap">{parsed.detailedFeedback}</p>
                                </div>
                              )}
                              <button onClick={() => openReview(round, round.status as 'PASSED' | 'FAILED')}
                                className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 font-medium">
                                <Pencil className="w-3.5 h-3.5" /> Edit Review
                              </button>
                            </div>
                          ) : (
                            <div className="mt-3 text-sm text-gray-500 italic">No review notes recorded.
                              <button onClick={() => openReview(round, round.status as 'PASSED' | 'FAILED')}
                                className="ml-2 text-blue-400 hover:underline not-italic">Add now</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl my-4">
            <div className={`px-6 py-5 rounded-t-2xl ${form.verdict === 'PASSED' ? 'bg-gradient-to-r from-green-700 to-emerald-700' : 'bg-gradient-to-r from-red-700 to-rose-700'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {form.verdict === 'PASSED' ? 'Pass' : 'Fail'} — Interview Review
                  </h2>
                  <p className="text-white/70 text-sm mt-1">
                    {reviewModal.application?.candidateName} · {roundTypeLabel[reviewModal.type]} · {reviewModal.application?.position?.title}
                  </p>
                </div>
                {reviewModal.type !== 'TEST' && reviewModal.application?.resumePath && (
                  <a href={reviewModal.application.resumePath} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-all flex-shrink-0">
                    <FileText className="w-3.5 h-3.5" /> Open Resume
                  </a>
                )}
              </div>
            </div>

            <form onSubmit={submitReview} className="px-6 py-5 space-y-5">
              <div className="flex rounded-xl overflow-hidden border border-gray-600">
                <button type="button" onClick={() => setForm(f => ({ ...f, verdict: 'PASSED' }))}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${form.verdict === 'PASSED' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                  Pass
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, verdict: 'FAILED' }))}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-all ${form.verdict === 'FAILED' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                  Fail
                </button>
              </div>

              <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Candidate Ratings</p>
                <StarRating label="Technical Skills" value={form.technicalSkills} onChange={v => setForm(f => ({ ...f, technicalSkills: v }))} />
                <StarRating label="Problem Solving" value={form.problemSolving} onChange={v => setForm(f => ({ ...f, problemSolving: v }))} />
                <StarRating label="Communication" value={form.communication} onChange={v => setForm(f => ({ ...f, communication: v }))} />
                <StarRating label="Cultural Fit" value={form.culturalFit} onChange={v => setForm(f => ({ ...f, culturalFit: v }))} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Strengths</label>
                <textarea value={form.strengths} onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))}
                  rows={2} placeholder="What did the candidate do well?"
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 resize-none" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Areas to Improve</label>
                <textarea value={form.improvements} onChange={e => setForm(f => ({ ...f, improvements: e.target.value }))}
                  rows={2} placeholder="What could the candidate improve?"
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 resize-none" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Detailed Feedback</label>
                <textarea value={form.detailedFeedback} onChange={e => setForm(f => ({ ...f, detailedFeedback: e.target.value }))}
                  rows={5} placeholder="Write a comprehensive review of the interview..."
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-xl text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-400/50 resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setReviewModal(null)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-400 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={updating}
                  className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-60 transition-all ${form.verdict === 'PASSED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                  {updating ? 'Saving...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
