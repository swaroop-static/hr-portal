import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAttemptById } from '../../api';
import { useAuth } from '../../context/AuthContext';

function parseOptions(options: string | null | undefined) {
  if (!options) return [];
  try { return JSON.parse(options); } catch { return []; }
}

export default function TestResponseViewer() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    setLoading(true);
    getAttemptById(attemptId)
      .then(data => setAttempt(data))
      .catch(err => setError(err?.response?.data?.error || 'Failed to load test attempt.'))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <div className="p-6 max-w-5xl mx-auto text-gray-500">Loading attempt...</div>;
  if (!attempt) return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center">
        <p className="text-lg font-semibold text-gray-800">Unable to find the test attempt.</p>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <button onClick={() => navigate(-1)} className="mt-4 px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700">Go back</button>
      </div>
    </div>
  );

  const questions = attempt.round?.test?.questions || [];
  const mcqQuestions = questions.filter((q: any) => q.type === 'MCQ');
  const textQuestions = questions.filter((q: any) => q.type === 'TEXT');
  const responses = attempt.responses || {};

  const backRoute = user?.role === 'INTERVIEWER'
    ? '/interviewer'
    : user?.role === 'ADMIN'
      ? '/admin'
      : '/hr';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submitted Test Responses</h1>
          <p className="text-sm text-gray-500 mt-1">Candidate: {attempt.round?.application?.candidateName || attempt.round?.application?.candidateEmail}</p>
          <p className="text-sm text-gray-500">Test: {attempt.round?.test?.title || 'Untitled Test'}</p>
          <p className="text-sm text-gray-500">This view is read-only and shows the candidate's submitted answers.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={backRoute} className="px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100">← Back</Link>
          <div className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl">Status: {attempt.status}</div>
          <div className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl">Score: {attempt.score ?? 'N/A'}</div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {mcqQuestions.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">MCQ Responses</h2>
          <div className="space-y-4">
            {mcqQuestions.map((q: any, idx: number) => {
              const options = parseOptions(q.options);
              const selected = responses[q.id];
              const selectedIndex = selected !== undefined && selected !== null && selected !== '' ? Number(selected) : NaN;
              const correctIndex = q.answer !== undefined && q.answer !== null && q.answer !== '' ? Number(q.answer) : NaN;
              const selectedText = Number.isInteger(selectedIndex) ? options[selectedIndex] ?? 'Not Answered' : 'Not Answered';
              const correctText = Number.isInteger(correctIndex) ? options[correctIndex] ?? 'Not provided' : 'Not provided';
              const isCorrect = Number.isInteger(selectedIndex) && Number.isInteger(correctIndex)
                ? selectedIndex === correctIndex
                : null;
              return (
                <div key={q.id} className="rounded-3xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-semibold">Q{idx + 1}. {q.text}</div>
                      <div className="text-xs text-gray-500 mt-1">MCQ</div>
                    </div>
                    <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isCorrect === true ? 'bg-green-100 text-green-700' : isCorrect === false ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {isCorrect === true ? 'Correct' : isCorrect === false ? 'Incorrect' : 'Answer unavailable'}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                      <p className="text-xs font-semibold text-blue-700 mb-1">Candidate answer</p>
                      <p className="text-sm text-gray-700">{selectedText}</p>
                    </div>
                    <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                      <p className="text-xs font-semibold text-green-700 mb-1">Correct answer</p>
                      <p className="text-sm text-gray-700">{correctText}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Text Responses</h2>
        {textQuestions.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">No text questions in this test.</div>
        ) : (
          <div className="space-y-4">
            {textQuestions.map((q: any, idx: number) => {
              const answer = responses[q.id];
              const displayAnswer = answer !== undefined && answer !== null && String(answer).trim() !== ''
                ? String(answer)
                : 'Not Answered';
              return (
                <div key={q.id} className="rounded-3xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">Q{idx + 1}. {q.text}</div>
                    <div className="text-xs text-gray-500">Text</div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap">{displayAnswer}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
