import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAttemptById, gradeAttempt } from '../../api';

function parseOptions(options: string | null | undefined) {
  if (!options) return [];
  try { return JSON.parse(options); } catch { return []; }
}

export default function InterviewerAttemptGrade() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<any>(null);
  const [form, setForm] = useState<Record<string, { score: string; feedback: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    setLoading(true);
    getAttemptById(attemptId)
      .then(data => {
        setAttempt(data);
        const grades: Record<string, { score: string; feedback: string }> = {};
        (data.round?.test?.questions || [])
          .filter((q: any) => q.type === 'TEXT')
          .forEach((q: any) => {
            const existing = (data.grading || {})[q.id] || {};
            grades[q.id] = { score: existing.score?.toString() ?? '', feedback: existing.feedback ?? '' };
          });
        setForm(grades);
      })
      .catch(err => {
        setError(err?.response?.data?.error || 'Failed to load test attempt.');
      })
      .finally(() => setLoading(false));
  }, [attemptId]);

  const handleChange = (questionId: string, field: 'score' | 'feedback', value: string) => {
    setForm(prev => ({ ...prev, [questionId]: { ...prev[questionId], [field]: value } }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!attemptId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, { score: number; feedback: string }> = {};
    try {
      Object.entries(form).forEach(([questionId, data]) => {
        payload[questionId] = { score: Number(data.score), feedback: data.feedback || '' };
      });
      const updated = await gradeAttempt(attemptId, payload);
      setAttempt(updated);
      setSuccess('Grades saved successfully.');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save grades.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 max-w-5xl mx-auto text-gray-500">Loading attempt...</div>;

  if (!attempt) return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center">
        <p className="text-lg font-semibold text-gray-800">Unable to find the test attempt.</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700">Go back</button>
      </div>
    </div>
  );

  const questions = attempt.round?.test?.questions || [];
  const textQuestions = questions.filter((q: any) => q.type === 'TEXT');
  const mcqQuestions = questions.filter((q: any) => q.type === 'MCQ');
  const responses = attempt.responses || {};

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grade Test Attempt</h1>
          <p className="text-sm text-gray-500 mt-1">Candidate: {attempt.round?.application?.candidateName || attempt.round?.application?.candidateEmail}</p>
          <p className="text-sm text-gray-500">Test: {attempt.round?.test?.title || 'Untitled Test'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/interviewer" className="px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100">← Back to dashboard</Link>
          <div className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl">Current score: {attempt.score ?? 'N/A'}</div>
          <div className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl">Status: {attempt.status}</div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      {mcqQuestions.length > 0 && (
        <section className="mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Auto-graded MCQ Questions</h2>
            <p className="text-sm text-gray-500">Candidate answers vs correct answers.</p>
          </div>
          <div className="space-y-4">
            {mcqQuestions.map((question: any, index: number) => {
              const options = parseOptions(question.options);
              const selectedAnswer = responses[question.id];
              const correctAnswer = question.answer;
              const selectedText = selectedAnswer !== undefined ? options[Number(selectedAnswer)] : 'No answer provided';
              const correctText = correctAnswer !== undefined ? options[Number(correctAnswer)] : 'Not provided';
              return (
                <div key={question.id} className="rounded-3xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="font-semibold text-gray-800">Q{index + 1}. {question.text}</span>
                    <span className="text-xs uppercase tracking-wide text-gray-500">MCQ</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold mb-2">Candidate answer</p>
                      <p>{selectedText}</p>
                    </div>
                    <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-green-700 font-semibold mb-2">Correct answer</p>
                      <p>{correctText}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Text Questions</h2>
            <p className="text-sm text-gray-500">Assign scores and feedback for submitted text responses.</p>
          </div>
          <div className="text-sm text-gray-500">{textQuestions.length} text question{textQuestions.length === 1 ? '' : 's'}</div>
        </div>

        {textQuestions.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
            This test does not contain text questions to grade.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {textQuestions.map((question: any, index: number) => (
              <div key={question.id} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900">Q{index + 1}. {question.text}</h3>
                    <p className="text-sm text-gray-500 mt-1">Response:</p>
                    <div className="mt-2 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap">
                      {responses[question.id] ?? 'No response provided.'}
                    </div>
                  </div>
                  <div className="mt-4 sm:mt-0 sm:w-40 sm:ml-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Score</label>
                    <input
                      type="number"
                      min={0}
                      max={question.maxMarks ?? 1}
                      value={form[question.id]?.score ?? ''}
                      onChange={e => handleChange(question.id, 'score', e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
                      placeholder={`0 / ${question.maxMarks ?? 1}`} />
                    <p className="text-xs text-gray-400 mt-2">Max {question.maxMarks ?? 1}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Feedback</label>
                  <textarea
                    value={form[question.id]?.feedback ?? ''}
                    onChange={e => handleChange(question.id, 'feedback', e.target.value)}
                    rows={3}
                    className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
                    placeholder="Enter reviewer feedback for the candidate." />
                </div>
              </div>
            ))}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
              <div className="text-sm text-gray-500">
                After submitting, the attempt score will be updated using the graded text responses and any auto-graded MCQs.
              </div>
              <button type="submit" disabled={saving}
                className="rounded-3xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Saving grades...' : 'Save Grades'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
