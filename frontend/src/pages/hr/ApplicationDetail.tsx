import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getApplication, createRound, updateRound, getTests, generateTestLink, getUsers, updateApplication, updateAttemptProctor, uploadResume, getTemplates, applyTemplate } from '../../api';
import SkillRadarChart from '../../components/SkillRadarChart';
import { CheckCircle, ClipboardList, Code2, MessageSquare, Star, Calendar, Clock } from 'lucide-react';

const roundTypes = ['TEST', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_INTERVIEW'];
const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  PASSED: 'bg-green-100 text-green-700 border-green-200',
  FAILED: 'bg-red-100 text-red-700 border-red-200',
};

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<any>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoundModal, setShowRoundModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState<any>(null);
  const [generatedLink, setGeneratedLink] = useState('');
  const [linkAlreadyExists, setLinkAlreadyExists] = useState(false);
  const [selectedProctorId, setSelectedProctorId] = useState('');
  const [roundForm, setRoundForm] = useState({ type: 'TEST', order: 1, testId: '', interviewerId: '', scheduledAt: '' });
  const [updatingRound, setUpdatingRound] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [updatingProctor, setUpdatingProctor] = useState(false);
  const [proctorUpdateDone, setProctorUpdateDone] = useState(false);
  const [editingInterviewerRound, setEditingInterviewerRound] = useState<string | null>(null);
  const [savingInterviewer, setSavingInterviewer] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const user = (() => { try { return JSON.parse(localStorage.getItem('hr_portal_user') || '{}'); } catch { return {}; } })();

  // Apply template
  const [templates, setTemplates] = useState<any[]>([]);
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [applyTemplateResult, setApplyTemplateResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = async () => {
    try {
      const [appData, testsData, usersData, templatesData] = await Promise.all([
        getApplication(id!), getTests(), getUsers(), getTemplates(),
      ]);
      setApp(appData);
      setTests(testsData);
      setStaffUsers(usersData.filter((u: any) => ['HR', 'ADMIN', 'INTERVIEWER'].includes(u.role)));
      setTemplates(templatesData);
      if (appData.rounds.length > 0) setRoundForm(f => ({ ...f, order: appData.rounds.length + 1 }));
      setError(null);
    } catch (e: any) {
      if (!app) setError(e?.response?.data?.error || 'Failed to load. Please refresh.');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRound({
        applicationId: id,
        type: roundForm.type,
        order: roundForm.order,
        testId: roundForm.testId || null,
        scheduledAt: roundForm.scheduledAt || null,
        interviewerId: roundForm.interviewerId || null,
      });
      setShowRoundModal(false);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load. Please refresh.');
    }
  };

  const handleRoundStatus = async (roundId: string, status: string, notes?: string) => {
    setUpdatingRound(roundId);
    try {
      await updateRound(roundId, { status, notes });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load. Please refresh.');
    }
    setUpdatingRound(null);
  };

  const handleGenerateLink = async (round: any) => {
    setShowLinkModal(round);
    setGeneratedLink('');
    setLinkAlreadyExists(false);
    setSelectedProctorId('');
    setProctorUpdateDone(false);
  };

  const confirmGenerateLink = async () => {
    if (!showLinkModal) return;
    if (!showLinkModal?.testId) {
      setError('This round has no test assigned. Please assign a test to this round first.');
      setShowLinkModal(null);
      return;
    }
    try {
      const result = await generateTestLink(showLinkModal.testId, {
        roundId: showLinkModal.id,
        candidateName: app.candidateName,
        candidateEmail: app.candidateEmail,
        proctorId: selectedProctorId || null,
      });
      setGeneratedLink(result?.link || '');
      setLinkAlreadyExists(result?.alreadyExists || false);
      await load(); // refresh to get updated round status
    } catch (e: any) {
      setGeneratedLink('Error: ' + (e?.response?.data?.error || e.message));
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!app) return (
    <div className="p-8 text-center">
      <p className="text-red-500 font-semibold mb-2">Candidate not found</p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={() => window.history.back()} className="mt-4 px-4 py-2 text-sm bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200">← Go back</button>
    </div>
  );

  return (
    <div className="p-8">
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
          <span className="text-sm font-medium">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4 text-lg leading-none">×</button>
        </div>
      )}
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/hr/applications" className="hover:text-blue-600 transition-colors">Candidates</Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{app.candidateName}</span>
      </div>

      {/* Candidate header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white text-xl font-bold">
              {app.candidateName?.[0] ?? '?'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{app.candidateName}</h1>
              <p className="text-gray-400 text-sm">{app.candidateEmail}</p>
              <p className="text-gray-500 text-sm mt-1">
                Applying for: <span className="font-semibold text-gray-700">{app.position?.title}</span>
                <span className="text-gray-400"> · {app.position?.department}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${statusColors[app.status]}`}>
              {app.status.replace('_', ' ')}
            </span>
            <button onClick={() => setShowRoundModal(true)}
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-all shadow-md"
              style={{ background: '#1e3a5f' }}>
              + Add Round
            </button>
          </div>
        </div>
      </div>

      {/* Candidate Credentials */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Candidate Login Credentials</p>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Email</p>
            <p className="text-sm font-mono font-medium text-gray-900">{app.candidateEmail}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Password</p>
            {settingPassword ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-400 w-44"
                  autoFocus
                />
                <button
                  disabled={savingPassword || !newPassword.trim()}
                  onClick={async () => {
                    setSavingPassword(true);
                    try {
                      await updateApplication(id!, { candidatePassword: newPassword.trim() });
                      setSettingPassword(false);
                      setNewPassword('');
                      load();
                    } catch (e: any) {
                      setError(e?.response?.data?.error || 'Failed to save password');
                    }
                    setSavingPassword(false);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                  style={{ background: '#1e3a5f' }}>
                  {savingPassword ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => { setSettingPassword(false); setNewPassword(''); }}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            ) : app?.candidatePassword ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium text-gray-900">
                  {showPassword ? app.candidatePassword : '••••••••'}
                </span>
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="text-xs text-blue-500 hover:text-blue-700 underline">
                  {showPassword ? 'hide' : 'show'}
                </button>
                <button onClick={() => { setSettingPassword(true); setNewPassword(app.candidatePassword); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">
                  change
                </button>
              </div>
            ) : (
              <button onClick={() => setSettingPassword(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline">
                + Set Password
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resume */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Resume</p>
            {app.resumePath ? (
              <div className="flex items-center gap-3">
                <a href={app.resumePath} target="_blank" rel="noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 underline flex items-center gap-1">
                  📄 {app.resumeName || 'View Resume'}
                </a>
                <span className="text-xs text-gray-400">PDF</span>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No resume uploaded</p>
            )}
          </div>
          {['HR', 'ADMIN'].includes(user.role) && (
            <div className="flex items-center gap-2">
              <input ref={resumeInputRef} type="file" accept="application/pdf" className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingResume(true);
                  try { await uploadResume(id!, file); await load(); } catch {}
                  setUploadingResume(false);
                  if (resumeInputRef.current) resumeInputRef.current.value = '';
                }} />
              <button onClick={() => resumeInputRef.current?.click()}
                disabled={uploadingResume}
                className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 hover:opacity-90"
                style={{ background: '#1e3a5f' }}>
                {uploadingResume ? 'Uploading...' : app.resumePath ? 'Replace' : 'Upload PDF'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Skill Radar Chart — shown when candidate has completed at least one test */}
      {(() => {
        const skills = (app.rounds || [])
          .filter((r: any) => r.type === 'TEST' && r.test && r.testAttempt?.score !== null && r.testAttempt?.score !== undefined && ['SUBMITTED', 'TERMINATED'].includes(r.testAttempt?.status))
          .map((r: any) => ({ label: r.test.title, score: r.testAttempt.score as number }));
        if (skills.length < 1) return null;
        const avg = Math.round(skills.reduce((a: number, s: any) => a + s.score, 0) / skills.length);
        const avgColor = avg >= 70 ? 'text-green-600' : avg >= 50 ? 'text-yellow-600' : 'text-red-600';
        const avgBg = avg >= 70 ? 'bg-green-50 border-green-200' : avg >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';
        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Skill Profile</p>
                <h2 className="text-base font-bold text-gray-900 mt-0.5">{app.candidateName}'s Technical Assessment</h2>
              </div>
              <div className={`px-4 py-2 rounded-xl border text-center ${avgBg}`}>
                <div className={`text-2xl font-bold ${avgColor}`}>{avg}%</div>
                <div className="text-xs text-gray-500">Avg Score</div>
              </div>
            </div>
            {skills.length >= 3 ? (
              <div className="flex justify-center">
                <SkillRadarChart skills={skills} />
              </div>
            ) : (
              <div className="space-y-3">
                {skills.map((s: any) => {
                  const pct = s.score;
                  const barColor = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                  const label = pct >= 70 ? 'Strong' : pct >= 50 ? 'Average' : 'Needs work';
                  return (
                    <div key={s.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{s.label}</span>
                        <span className={`font-bold ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{pct}% · {label}</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Interview Journey Timeline */}
      {(() => {
        const formatDate = (d: string | null | undefined) =>
          d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

        const appStatusDotColor: Record<string, string> = {
          PENDING: 'bg-gray-700 border-2 border-gray-500',
          IN_PROGRESS: 'bg-blue-900 border-2 border-blue-500',
          SELECTED: 'bg-green-900 border-2 border-green-500',
          REJECTED: 'bg-red-900 border-2 border-red-500',
        };

        const roundStatusDotColor: Record<string, string> = {
          PASSED: 'bg-green-900 border-2 border-green-500',
          FAILED: 'bg-red-900 border-2 border-red-500',
          IN_PROGRESS: 'bg-blue-900 border-2 border-blue-500',
          PENDING: 'bg-gray-700 border-2 border-gray-500',
        };

        const roundStatusTextColor: Record<string, string> = {
          PASSED: 'text-green-400 bg-green-900/50 border border-green-700',
          FAILED: 'text-red-400 bg-red-900/50 border border-red-700',
          IN_PROGRESS: 'text-blue-400 bg-blue-900/50 border border-blue-700',
          PENDING: 'text-gray-400 bg-gray-800 border border-gray-600',
        };

        const appStatusTextColor: Record<string, string> = {
          PENDING: 'text-gray-400 bg-gray-800 border border-gray-600',
          IN_PROGRESS: 'text-blue-400 bg-blue-900/50 border border-blue-700',
          SELECTED: 'text-green-400 bg-green-900/50 border border-green-700',
          REJECTED: 'text-red-400 bg-red-900/50 border border-red-700',
        };

        const scorecardPillColor: Record<string, string> = {
          'Strong Hire': 'text-green-400 bg-green-900/60 border border-green-700',
          'Hire': 'text-blue-400 bg-blue-900/60 border border-blue-700',
          'No Hire': 'text-orange-400 bg-orange-900/60 border border-orange-700',
          'Strong No Hire': 'text-red-400 bg-red-900/60 border border-red-700',
        };

        const RoundIcon = ({ type }: { type: string }) => {
          const cls = 'w-4 h-4';
          if (type === 'TEST') return <ClipboardList className={cls} />;
          if (type === 'TECHNICAL_INTERVIEW') return <Code2 className={cls} />;
          if (type === 'HR_INTERVIEW') return <MessageSquare className={cls} />;
          if (type === 'FINAL_INTERVIEW') return <Star className={cls} />;
          return <Calendar className={cls} />;
        };

        const roundTypeLabel: Record<string, string> = {
          TEST: 'Online Assessment',
          TECHNICAL_INTERVIEW: 'Technical Interview',
          HR_INTERVIEW: 'HR Interview',
          FINAL_INTERVIEW: 'Final Interview',
        };

        const sortedRounds = [...(app.rounds || [])].sort((a: any, b: any) => a.order - b.order);

        type TimelineItem = {
          key: string;
          dotColor: string;
          icon: React.ReactNode;
          title: string;
          badge: React.ReactNode | null;
          subtitle: string | null;
          extra: React.ReactNode | null;
          date: string | null;
        };

        const items: TimelineItem[] = [];

        // 1. Application Received
        items.push({
          key: 'app-received',
          dotColor: 'bg-yellow-900 border-2 border-yellow-500',
          icon: <CheckCircle className="w-4 h-4 text-yellow-400" />,
          title: 'Application Received',
          badge: <span className="text-xs font-medium px-2 py-0.5 rounded-full text-green-400 bg-green-900/50 border border-green-700">Applied</span>,
          subtitle: null,
          extra: null,
          date: formatDate(app.createdAt),
        });

        // 2. One entry per round
        for (const round of sortedRounds) {
          let scorecard: any = null;
          if (round.scorecard) {
            try { scorecard = JSON.parse(round.scorecard); } catch { scorecard = null; }
          }
          const recommendation: string | undefined = scorecard?.recommendation;

          const subtitleParts: string[] = [];
          if (round.interviewer?.name) subtitleParts.push(`Interviewer: ${round.interviewer.name}`);
          if (!round.scheduledAt) subtitleParts.push('Not scheduled');

          items.push({
            key: round.id,
            dotColor: roundStatusDotColor[round.status] ?? 'bg-gray-700 border-2 border-gray-500',
            icon: <RoundIcon type={round.type} />,
            title: roundTypeLabel[round.type] ?? round.type.replace(/_/g, ' '),
            badge: (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roundStatusTextColor[round.status] ?? 'text-gray-400 bg-gray-800 border border-gray-600'}`}>
                {round.status.replace('_', ' ')}
              </span>
            ),
            subtitle: subtitleParts.join(' · ') || null,
            extra: (
              <div className="flex items-center gap-2 flex-wrap">
                {recommendation && scorecardPillColor[recommendation] && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${scorecardPillColor[recommendation]}`}>
                    {recommendation}
                  </span>
                )}
                {round.type !== 'TEST' && (
                  <Link
                    to={`/interview/${round.id}/timeline`}
                    className="text-xs font-medium text-yellow-400 hover:text-yellow-300 transition-colors underline"
                  >
                    Timeline →
                  </Link>
                )}
              </div>
            ),
            date: formatDate(round.scheduledAt),
          });
        }

        // 3. Current Status
        items.push({
          key: 'current-status',
          dotColor: appStatusDotColor[app.status] ?? 'bg-gray-700 border-2 border-gray-500',
          icon: <Clock className="w-4 h-4" />,
          title: 'Current Status',
          badge: (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${appStatusTextColor[app.status] ?? 'text-gray-400 bg-gray-800 border border-gray-600'}`}>
              {app.status.replace('_', ' ')}
            </span>
          ),
          subtitle: null,
          extra: null,
          date: null,
        });

        return (
          <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-sm p-6 mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Interview Journey</p>
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-gray-700" />
              {items.map((item, i) => (
                <div key={item.key} className={`relative flex gap-4 ${i < items.length - 1 ? 'pb-8' : ''}`}>
                  {/* Dot */}
                  <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-gray-200 ${item.dotColor}`}>
                    {item.icon}
                  </div>
                  {/* Content */}
                  <div className="flex-1 pt-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white">{item.title}</span>
                      {item.badge}
                      {item.extra}
                    </div>
                    {item.subtitle && (
                      <div className="text-sm text-gray-400 mt-0.5">{item.subtitle}</div>
                    )}
                  </div>
                  {/* Date */}
                  {item.date && (
                    <div className="text-sm text-gray-500 pt-1 shrink-0">{item.date}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Rounds */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Recruitment Pipeline</h2>
          {templates.length > 0 && (
            <button
              onClick={() => { setShowApplyTemplate(s => !s); setApplyTemplateResult(null); }}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all border border-indigo-200"
            >
              Apply Template
            </button>
          )}
        </div>

        {/* Apply template inline panel */}
        {showApplyTemplate && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">Apply Interview Template</p>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedTemplateId}
                onChange={e => { setSelectedTemplateId(e.target.value); setApplyTemplateResult(null); }}
                className="flex-1 min-w-48 px-3 py-2 border border-indigo-300 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-500 text-gray-800"
              >
                <option value="">Select a template...</option>
                {templates.map((tpl: any) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}{tpl.department ? ` (${tpl.department})` : ''} — {tpl.stages?.length ?? 0} stage{(tpl.stages?.length ?? 0) !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
              <button
                disabled={applyingTemplate || !selectedTemplateId}
                onClick={async () => {
                  if (!selectedTemplateId || !id) return;
                  setApplyingTemplate(true);
                  try {
                    const result = await applyTemplate(selectedTemplateId, id);
                    setApplyTemplateResult({
                      ok: true,
                      message: `${result.roundsCreated ?? result.rounds?.length ?? 0} rounds created successfully.`,
                    });
                    await load();
                  } catch (e: any) {
                    setApplyTemplateResult({
                      ok: false,
                      message: e?.response?.data?.error || 'Failed to apply template.',
                    });
                  }
                  setApplyingTemplate(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-all"
                style={{ background: '#3730a3' }}
              >
                {applyingTemplate ? 'Applying...' : 'Apply'}
              </button>
              <button
                onClick={() => { setShowApplyTemplate(false); setApplyTemplateResult(null); setSelectedTemplateId(''); }}
                className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
            {applyTemplateResult && (
              <p className={`text-xs mt-2 font-medium ${applyTemplateResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {applyTemplateResult.ok ? '✓ ' : '✗ '}{applyTemplateResult.message}
              </p>
            )}
          </div>
        )}

        {app.rounds.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-gray-500 font-medium">No rounds added yet</p>
            <p className="text-gray-400 text-sm mt-1">Add the first round to start the recruitment process</p>
            <button onClick={() => setShowRoundModal(true)} className="mt-4 px-5 py-2 text-white rounded-lg text-sm font-semibold" style={{ background: '#1e3a5f' }}>Add Round</button>
          </div>
        ) : (
          <div className="space-y-4">
            {app.rounds.map((round: any, idx: number) => (
              <div key={round.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-5">
                  {/* Step number */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    round.status === 'PASSED' ? 'bg-green-100 text-green-700' :
                    round.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                    round.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">
                        {round.type.replace('_', ' ')}
                      </span>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusColors[round.status]}`}>
                        {round.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                      {round.test && <span>📝 {round.test.title} ({round.test.duration} min)</span>}
                      {round.interviewer && <span>👤 {round.interviewer.name}</span>}
                      {round.scheduledAt && <span>📅 {new Date(round.scheduledAt).toLocaleDateString()}</span>}
                      {round.testAttempt && (
                        <span className="font-medium">
                          Score: {round.testAttempt.score ?? 'N/A'}% · Tab switches: {round.testAttempt.tabSwitches}
                        </span>
                      )}
                    </div>
                    {round.notes && <p className="text-xs text-gray-500 mt-1 italic">"{round.notes}"</p>}
                    {/* Inline interviewer assignment */}
                    {editingInterviewerRound === round.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <select id={`interviewer-${round.id}`} defaultValue={round.interviewerId || ''}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
                          <option value="">No interviewer</option>
                          {staffUsers.filter((u: any) => u.role === 'INTERVIEWER' || u.role === 'ADMIN').map((u: any) =>
                            <option key={u.id} value={u.id}>{u.name}</option>
                          )}
                        </select>
                        <button disabled={savingInterviewer} onClick={async () => {
                          setSavingInterviewer(true);
                          try {
                            const sel = document.getElementById(`interviewer-${round.id}`) as HTMLSelectElement | null;
                            await updateRound(round.id, { interviewerId: sel?.value || null });
                            setEditingInterviewerRound(null);
                            await load();
                          } catch {}
                          setSavingInterviewer(false);
                        }} className="text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                          {savingInterviewer ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditingInterviewerRound(null)} className="text-xs px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingInterviewerRound(round.id)}
                        className="mt-2 text-xs text-blue-500 hover:text-blue-700 underline">
                        {round.interviewer ? `Interviewer: ${round.interviewer.name} · change` : 'Assign Interviewer'}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Generate link (only if no attempt yet) */}
                    {round.type === 'TEST' && round.testId && !round.testAttempt && (
                      <button onClick={() => handleGenerateLink(round)}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all">
                        Generate Link
                      </button>
                    )}
                    {/* View existing link (always visible once generated) */}
                    {round.type === 'TEST' && round.testAttempt && (
                      <button onClick={() => {
                        setShowLinkModal(round);
                        setGeneratedLink(`${window.location.origin}/test/${round.testAttempt.token}`);
                        setLinkAlreadyExists(true);
                        setSelectedProctorId(round.testAttempt.proctorId || '');
                        setProctorUpdateDone(false);
                      }} className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all">
                        View Link 🔗
                      </button>
                    )}
                    {/* Proctor link */}
                    {round.testAttempt && round.testAttempt.status === 'IN_PROGRESS' && (
                      <Link to={`/hr/proctor/${round.testAttempt.id}`}
                        className="px-3 py-1.5 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-all">
                        Watch Live 🎥
                      </Link>
                    )}
                    {/* View submitted responses */}
                    {round.testAttempt && ['SUBMITTED', 'TERMINATED'].includes(round.testAttempt.status) && (
                      <Link to={`/tests/attempt/${round.testAttempt.id}/view`}
                        className="px-3 py-1.5 text-xs font-semibold text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-lg transition-all">
                        View Responses 📋
                      </Link>
                    )}
                    {/* Status actions */}
                    {round.status === 'PENDING' || round.status === 'IN_PROGRESS' ? (
                      <>
                        <button disabled={updatingRound === round.id} onClick={() => handleRoundStatus(round.id, 'PASSED')}
                          className="px-3 py-1.5 text-xs font-semibold text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-all disabled:opacity-50">
                          Pass
                        </button>
                        <button disabled={updatingRound === round.id} onClick={() => handleRoundStatus(round.id, 'FAILED')}
                          className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50">
                          Fail
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Round Modal */}
      {showRoundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Add New Round</h2>
            </div>
            <form onSubmit={handleCreateRound} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Round Type</label>
                <select value={roundForm.type} onChange={e => setRoundForm({ ...roundForm, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none">
                  {roundTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Order / Step</label>
                <input type="number" min={1} value={roundForm.order} onChange={e => setRoundForm({ ...roundForm, order: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none" />
              </div>
              {roundForm.type === 'TEST' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Assign Test</label>
                  <select value={roundForm.testId} onChange={e => setRoundForm({ ...roundForm, testId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none">
                    <option value="">Select a test...</option>
                    {tests.map(t => <option key={t.id} value={t.id}>{t.title} ({t.duration} min)</option>)}
                  </select>
                </div>
              )}
              {roundForm.type !== 'TEST' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Interviewer</label>
                  <select
                    value={roundForm.interviewerId || ''}
                    onChange={e => setRoundForm((f: any) => ({ ...f, interviewerId: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value="">Select interviewer (optional)</option>
                    {staffUsers.filter((u: any) => u.role === 'INTERVIEWER').map((iv: any) => (
                      <option key={iv.id} value={iv.id}>{iv.name} ({iv.email})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Scheduled Date (optional)</label>
                <input type="datetime-local" value={roundForm.scheduledAt} onChange={e => setRoundForm({ ...roundForm, scheduledAt: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowRoundModal(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2.5 text-sm font-medium text-white rounded-xl" style={{ background: '#1e3a5f' }}>Add Round</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Setup Test Session</h2>
              <p className="text-sm text-gray-500 mt-1">For: {app?.candidateName} — {showLinkModal.test?.title}</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              {!generatedLink ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Assign Monitor (optional)</label>
                    <select value={selectedProctorId} onChange={e => setSelectedProctorId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none">
                      <option value="">No monitor assigned (unmonitored test)</option>
                      {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                    <p className="text-xs text-gray-400 mt-1.5">The assigned monitor can watch the live webcam feed during the test</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
                    <p className="font-semibold mb-1">Candidate login credentials:</p>
                    <p>Email: <span className="font-mono">{app?.candidateEmail}</span></p>
                    <div className="flex items-center gap-2 mt-1">
                      <span>Password:</span>
                      {app?.candidatePassword ? (
                        <>
                          <span className="font-mono">{showPassword ? app.candidatePassword : '••••••••'}</span>
                          <button type="button" onClick={() => setShowPassword(p => !p)}
                            className="text-xs underline text-blue-500 hover:text-blue-700">
                            {showPassword ? 'hide' : 'show'}
                          </button>
                        </>
                      ) : (
                        <span className="italic text-blue-400">No password set</span>
                      )}
                    </div>
                  </div>
                  <button onClick={confirmGenerateLink} className="w-full py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90" style={{ background: '#1e3a5f' }}>
                    Generate Test Session
                  </button>
                </>
              ) : (
                <>
                  {/* Candidate credentials */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Share these with the candidate</p>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-gray-500">Test Link</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-blue-700 break-all">{generatedLink}</span>
                        <button onClick={() => navigator.clipboard.writeText(generatedLink)}
                          className="text-xs text-gray-400 hover:text-blue-600 flex-shrink-0" title="Copy link">📋</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Email</span>
                      <span className="text-sm font-mono font-medium text-gray-900">{app?.candidateEmail}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Password</span>
                      <div className="flex items-center gap-2">
                        {app?.candidatePassword ? (
                          <>
                            <span className="text-sm font-mono font-medium text-gray-900">
                              {showPassword ? app.candidatePassword : '••••••••'}
                            </span>
                            <button type="button" onClick={() => setShowPassword(p => !p)}
                              className="text-xs text-blue-500 hover:text-blue-700 underline">
                              {showPassword ? 'hide' : 'show'}
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400 italic">No password set</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Monitor assignment — always editable */}
                  <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-gray-700">Assign / Change Monitor</p>
                    <select value={selectedProctorId} onChange={e => { setSelectedProctorId(e.target.value); setProctorUpdateDone(false); }}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none">
                      <option value="">No monitor (unmonitored)</option>
                      {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                    {proctorUpdateDone ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
                        ✅ Monitor updated successfully
                      </div>
                    ) : (
                      <button
                        disabled={updatingProctor}
                        onClick={async () => {
                          setUpdatingProctor(true);
                          try {
                            const token = showLinkModal?.testAttempt?.token;
                            await updateAttemptProctor(token, selectedProctorId || null);
                            setProctorUpdateDone(true);
                            load();
                          } catch (e: any) {
                            setError(e?.response?.data?.error || 'Failed to update monitor.');
                          }
                          setUpdatingProctor(false);
                        }}
                        className="w-full py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 hover:opacity-90 transition-all"
                        style={{ background: '#1e3a5f' }}>
                        {updatingProctor ? 'Saving...' : 'Save Monitor'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="px-6 pb-5">
              <button onClick={() => { setShowLinkModal(null); setGeneratedLink(''); load(); }} className="w-full py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
