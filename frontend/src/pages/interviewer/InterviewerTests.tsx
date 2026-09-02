import { useEffect, useState } from 'react';
import { getTests, createTest, deleteTest } from '../../api';
import { useAuth } from '../../context/AuthContext';

interface Question {
  text: string;
  type: 'MCQ' | 'TEXT';
  options: string[];
  answer: string;
  order: number;
}

export default function InterviewerTests() {
  const { user } = useAuth();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', duration: 30 });
  const [questions, setQuestions] = useState<Question[]>([
    { text: '', type: 'MCQ', options: ['', '', '', ''], answer: '0', order: 0 }
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    getTests().then(setTests).catch(() => { setError('Failed to load tests. Please refresh.'); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const addQuestion = () =>
    setQuestions(q => [...q, { text: '', type: 'MCQ', options: ['', '', '', ''], answer: '0', order: q.length }]);

  const removeQuestion = (i: number) => setQuestions(q => q.filter((_, idx) => idx !== i));

  const updateQuestion = (i: number, field: string, value: any) =>
    setQuestions(q => q.map((qu, idx) => idx === i ? { ...qu, [field]: value } : qu));

  const updateOption = (qi: number, oi: number, value: string) =>
    setQuestions(q => q.map((qu, idx) => idx === qi ? { ...qu, options: qu.options.map((o, j) => j === oi ? value : o) } : qu));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createTest({
        ...form,
        questions: questions.map((q, i) => ({
          text: q.text, type: q.type,
          options: q.type === 'MCQ' ? q.options : null,
          answer: q.type === 'MCQ' ? q.answer : null,
          order: i
        }))
      });
      setShowModal(false);
      setForm({ title: '', description: '', duration: 30 });
      setQuestions([{ text: '', type: 'MCQ', options: ['', '', '', ''], answer: '0', order: 0 }]);
      load();
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this test?')) return;
    try { await deleteTest(id); load(); } catch {}
  };

  // My tests = tests I created (filter by user ID to avoid name collisions)
  const myTests = tests.filter(t => t.createdBy?.id === user?.id);

  return (
    <div className="p-8">
      {error && (
        <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tests</h1>
          <p className="text-gray-500 text-sm mt-1">Create assessments for candidates — HR will assign them to interview rounds</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold shadow-md hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5a9e)' }}>
          + Create Test
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <span className="text-blue-500 text-lg flex-shrink-0">💡</span>
        <div className="text-sm text-blue-700">
          <strong>Your role:</strong> You create the test questions based on your domain expertise.
          HR picks your test and assigns it to a candidate's assessment round. You don't need to send anything — just build a good test.
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading tests...</div>
      ) : myTests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-gray-500 font-medium">No tests created yet</p>
          <p className="text-gray-400 text-sm mt-1">Create your first test so HR can assign it to candidates</p>
          <button onClick={() => setShowModal(true)} className="mt-4 px-5 py-2 text-white rounded-lg text-sm font-semibold" style={{ background: '#1e3a5f' }}>
            Create First Test
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {myTests.map(test => (
            <div key={test.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-gray-900">{test.title}</h3>
                  {test.createdBy && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      by {test.createdBy.name}
                    </span>
                  )}
                </div>
                {test.description && <p className="text-sm text-gray-400 mb-2">{test.description}</p>}
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>📋 {test._count?.questions ?? '?'} questions</span>
                  <span>⏱ {test.duration} minutes</span>
                  <span>📅 {new Date(test.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={() => handleDelete(test.id)}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Test Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="px-6 py-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-900">Create New Test</h2>
              <p className="text-sm text-gray-400 mt-0.5">Build questions for your domain — HR will assign this test to candidates</p>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Test Title</label>
                  <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g. React Developer Technical Assessment" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Duration (minutes)</label>
                  <input type="number" min={5} value={form.duration} onChange={e => setForm({ ...form, duration: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description (optional)</label>
                  <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none" placeholder="Brief overview" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-gray-700">Questions ({questions.length})</label>
                  <button type="button" onClick={addQuestion} className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg">
                    + Add Question
                  </button>
                </div>
                <div className="space-y-4">
                  {questions.map((q, qi) => (
                    <div key={qi} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-600">Question {qi + 1}</span>
                        {questions.length > 1 && (
                          <button type="button" onClick={() => removeQuestion(qi)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                        )}
                      </div>
                      <div className="space-y-3">
                        <input required value={q.text} onChange={e => updateQuestion(qi, 'text', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none bg-white"
                          placeholder="Question text..." />
                        <select value={q.type} onChange={e => updateQuestion(qi, 'type', e.target.value)}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none">
                          <option value="MCQ">Multiple Choice (MCQ)</option>
                          <option value="TEXT">Text Answer</option>
                        </select>
                        {q.type === 'MCQ' && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Options — select the correct answer</p>
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <input type="radio" name={`correct-${qi}`} checked={q.answer === String(oi)}
                                  onChange={() => updateQuestion(qi, 'answer', String(oi))} className="cursor-pointer" />
                                <input value={opt} onChange={e => updateOption(qi, oi, e.target.value)}
                                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
                                  placeholder={`Option ${oi + 1}`} required />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium text-white rounded-xl disabled:opacity-70" style={{ background: '#1e3a5f' }}>
                  {saving ? 'Creating...' : 'Create Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
