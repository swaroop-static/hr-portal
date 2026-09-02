import { useState, useEffect, useCallback } from 'react';
import { BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getQuestions, createQuestion, updateQuestion, deleteQuestion } from '../api';
import StatusBadge from '../components/ui/StatusBadge';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

interface Question {
  id: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  tags: string[];
  description: string;
  hints?: string;
  solution?: string;
}

interface QuestionFormData {
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  tags: string;
  description: string;
  hints: string;
  solution: string;
}


const emptyForm: QuestionFormData = {
  title: '', difficulty: 'MEDIUM', tags: '', description: '', hints: '', solution: '',
};

function Modal({ title, onClose, onSubmit, loading, formData, setFormData }: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  formData: QuestionFormData;
  setFormData: React.Dispatch<React.SetStateAction<QuestionFormData>>;
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', padding: '9px 12px', color: 'var(--text-primary,#e2e8f0)',
    fontSize: '13px', fontFamily: 'var(--font-body,system-ui)', outline: 'none',
    transition: 'border-color 0.15s',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim,#64748b)',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: '20px',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--obsidian-2,#161b22)', border: '1px solid var(--border-subtle,rgba(255,255,255,0.08))',
        borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary,#e2e8f0)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim,#64748b)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Title */}
          <div>
            <label style={labelStyle}>Title <span style={{ color: '#f87171' }}>*</span></label>
            <input
              style={inputStyle}
              value={formData.title}
              onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Two Sum"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label style={labelStyle}>Difficulty</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={formData.difficulty}
              onChange={e => setFormData(p => ({ ...p, difficulty: e.target.value as QuestionFormData['difficulty'] }))}
            >
              <option value="EASY">EASY</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HARD">HARD</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label style={labelStyle}>Tags <span style={{ color: 'var(--text-dim,#64748b)', fontWeight: 400, textTransform: 'none' }}>(comma-separated)</span></label>
            <input
              style={inputStyle}
              value={formData.tags}
              onChange={e => setFormData(p => ({ ...p, tags: e.target.value }))}
              placeholder="e.g. arrays, hash-map, dynamic-programming"
            />
            {/* Tag chips preview */}
            {formData.tags.trim() && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {formData.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                  <span key={tag} style={{ padding: '3px 10px', background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '99px', fontSize: '11px', color: 'var(--gold,#C9A84C)', fontWeight: 500 }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description / Problem Statement <span style={{ color: '#f87171' }}>*</span></label>
            <textarea
              style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
              value={formData.description}
              onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe the problem clearly, including examples and constraints..."
            />
          </div>

          {/* Hints */}
          <div>
            <label style={labelStyle}>Hints <span style={{ color: 'var(--text-dim,#64748b)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <textarea
              style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
              value={formData.hints}
              onChange={e => setFormData(p => ({ ...p, hints: e.target.value }))}
              placeholder="Add one or more hints to guide the candidate..."
            />
          </div>

          {/* Solution */}
          <div>
            <label style={labelStyle}>Solution <span style={{ color: 'var(--text-dim,#64748b)', fontWeight: 400, textTransform: 'none' }}>(optional — hidden from candidates)</span></label>
            <textarea
              style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
              value={formData.solution}
              onChange={e => setFormData(p => ({ ...p, solution: e.target.value }))}
              placeholder="Reference solution for the interviewer..."
            />
          </div>
        </div>

        {/* Modal footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
          <button onClick={onClose} disabled={loading} style={{ padding: '9px 20px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'var(--text-secondary,#94a3b8)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body,system-ui)' }}>
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || !formData.title.trim() || !formData.description.trim()}
            style={{
              padding: '9px 22px', borderRadius: '6px', border: 'none',
              background: 'var(--gold,#C9A84C)', color: '#0f1117', fontSize: '13px',
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading || !formData.title.trim() || !formData.description.trim() ? 0.6 : 1,
              fontFamily: 'var(--font-body,system-ui)',
            }}
          >
            {loading ? 'Saving...' : 'Save Question'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QuestionBank() {
  const { user } = useAuth();
  const toast = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formData, setFormData] = useState<QuestionFormData>(emptyForm);

  const canEdit = user?.role === 'HR' || user?.role === 'ADMIN';

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { difficulty?: string; search?: string } = {};
      if (difficulty) params.difficulty = difficulty;
      if (search.trim()) params.search = search.trim();
      const data = await getQuestions(params);
      setQuestions(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load questions.');
    } finally {
      setLoading(false);
    }
  }, [difficulty, search]);

  useEffect(() => {
    const timer = setTimeout(fetchQuestions, 300);
    return () => clearTimeout(timer);
  }, [fetchQuestions]);

  function openCreate() {
    setEditingQuestion(null);
    setFormData(emptyForm);
    setModalOpen(true);
  }

  function openEdit(q: Question) {
    setEditingQuestion(q);
    setFormData({
      title: q.title,
      difficulty: q.difficulty,
      tags: (q.tags || []).join(', '),
      description: q.description,
      hints: q.hints || '',
      solution: q.solution || '',
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingQuestion(null);
    setFormData(emptyForm);
  }

  async function handleSubmit() {
    if (!formData.title.trim() || !formData.description.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        difficulty: formData.difficulty,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        description: formData.description.trim(),
        hints: formData.hints.trim() || undefined,
        solution: formData.solution.trim() || undefined,
      };
      if (editingQuestion) {
        await updateQuestion(editingQuestion.id, payload);
      } else {
        await createQuestion(payload);
      }
      closeModal();
      await fetchQuestions();
      toast.success('Question saved');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to save question.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(q: Question) {
    if (!window.confirm(`Delete "${q.title}"? This action cannot be undone.`)) return;
    try {
      await deleteQuestion(q.id);
      await fetchQuestions();
      toast.success('Question deleted');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to delete question.';
      setError(msg);
      toast.error(msg);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
    padding: '9px 13px', fontSize: '13px', color: 'var(--text-primary,#e2e8f0)', outline: 'none',
    fontFamily: 'var(--font-body,system-ui)', transition: 'border-color 0.15s',
  };

  return (
    <div style={{ padding: '32px', minHeight: '100vh', background: 'var(--obsidian, #0f1117)', fontFamily: 'var(--font-body,system-ui)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--text-primary,#e2e8f0)', fontFamily: 'var(--font-display,system-ui)' }}>Question Bank</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-dim,#64748b)' }}>
            {questions.length} question{questions.length !== 1 ? 's' : ''} in library
          </p>
        </div>
        {canEdit && (
          <button onClick={openCreate} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 18px', borderRadius: '6px', border: 'none',
            background: 'var(--gold,#C9A84C)', color: '#0f1117', fontSize: '13px',
            fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body,system-ui)',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Question
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ width: 15, height: 15, position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            style={{ ...inputStyle, paddingLeft: '36px', width: '100%', boxSizing: 'border-box' }}
            placeholder="Search questions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          style={{ ...inputStyle, cursor: 'pointer', paddingRight: '28px', minWidth: '160px' }}
          value={difficulty}
          onChange={e => setDifficulty(e.target.value)}
        >
          <option value="">All Difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#ef4444', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Question list */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : questions.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No questions found"
          description="Try adjusting your filters or create a new question."
          action={canEdit ? { label: 'New Question', onClick: openCreate } : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {questions.map(q => (
            <div key={q.id} style={{
              background: 'var(--obsidian-2,#161b22)', border: '1px solid var(--border-subtle,rgba(255,255,255,0.08))', borderRadius: '10px',
              padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: '16px',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary,#e2e8f0)' }}>{q.title}</span>
                  <StatusBadge status={q.difficulty} showDot={false} />
                </div>

                {/* Description preview */}
                <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-secondary,#94a3b8)', lineHeight: 1.5 }}>
                  {q.description.length > 100 ? `${q.description.slice(0, 100)}…` : q.description}
                </p>

                {/* Tags */}
                {q.tags && q.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {q.tags.map(tag => (
                      <span key={tag} style={{ padding: '2px 9px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.22)', borderRadius: '99px', fontSize: '11px', color: 'var(--gold,#C9A84C)', fontWeight: 500 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {canEdit && (
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => openEdit(q)}
                    title="Edit"
                    style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: 'var(--text-secondary,#94a3b8)', transition: 'all 0.15s' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(q)}
                    title="Delete"
                    style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', cursor: 'pointer', color: '#ef4444', transition: 'all 0.15s' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <Modal
          title={editingQuestion ? 'Edit Question' : 'New Question'}
          onClose={closeModal}
          onSubmit={handleSubmit}
          loading={saving}
          formData={formData}
          setFormData={setFormData}
        />
      )}
    </div>
  );
}
