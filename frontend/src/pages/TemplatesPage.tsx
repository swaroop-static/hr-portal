import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, applyTemplate } from '../api';
import { SkeletonCard } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

const STAGE_TYPES = ['TEST', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_INTERVIEW'] as const;
type StageType = typeof STAGE_TYPES[number];

interface Stage {
  type: StageType;
  description: string;
  order: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  department: string;
  stages: Stage[];
  createdAt?: string;
}

const stageTypeColors: Record<StageType, string> = {
  TEST: 'bg-purple-900 text-purple-300 border-purple-700',
  TECHNICAL_INTERVIEW: 'bg-blue-900 text-blue-300 border-blue-700',
  HR_INTERVIEW: 'bg-green-900 text-green-300 border-green-700',
  FINAL_INTERVIEW: 'bg-yellow-900 text-yellow-300 border-yellow-700',
};

const stageTypeLabel: Record<StageType, string> = {
  TEST: 'Test',
  TECHNICAL_INTERVIEW: 'Technical',
  HR_INTERVIEW: 'HR Interview',
  FINAL_INTERVIEW: 'Final Interview',
};

const emptyForm = (): { name: string; description: string; department: string; stages: Stage[] } => ({
  name: '',
  description: '',
  department: '',
  stages: [],
});

export default function TemplatesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = user?.role === 'HR' || user?.role === 'ADMIN';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Apply template state keyed by templateId
  const [applyInput, setApplyInput] = useState<Record<string, string>>({});
  const [applyResult, setApplyResult] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [applying, setApplying] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getTemplates();
      setTemplates(data);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load templates.');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (tpl: Template) => {
    setEditingId(tpl.id);
    setForm({
      name: tpl.name,
      description: tpl.description || '',
      department: tpl.department || '',
      stages: tpl.stages ? tpl.stages.map((s, i) => ({ ...s, order: i + 1 })) : [],
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Template name is required.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        stages: form.stages.map((s, i) => ({ ...s, order: i + 1 })),
      };
      if (editingId) {
        await updateTemplate(editingId, payload);
      } else {
        await createTemplate(payload);
      }
      setShowModal(false);
      await load();
      toast.success('Template saved');
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Failed to save template.';
      setFormError(msg);
      toast.error(msg);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    try {
      await deleteTemplate(id);
      await load();
      toast.success('Template deleted');
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Failed to delete template.';
      setError(msg);
      toast.error(msg);
    }
  };

  const addStage = () => {
    setForm(f => ({
      ...f,
      stages: [...f.stages, { type: 'TECHNICAL_INTERVIEW', description: '', order: f.stages.length + 1 }],
    }));
  };

  const removeStage = (idx: number) => {
    setForm(f => ({ ...f, stages: f.stages.filter((_, i) => i !== idx) }));
  };

  const updateStage = (idx: number, patch: Partial<Stage>) => {
    setForm(f => ({
      ...f,
      stages: f.stages.map((s, i) => i === idx ? { ...s, ...patch } : s),
    }));
  };

  const handleApply = async (templateId: string) => {
    const appId = (applyInput[templateId] || '').trim();
    if (!appId) return;
    setApplying(templateId);
    try {
      const result = await applyTemplate(templateId, appId);
      setApplyResult(r => ({
        ...r,
        [templateId]: { ok: true, message: `${result.roundsCreated ?? result.rounds?.length ?? 0} rounds created` },
      }));
    } catch (e: any) {
      setApplyResult(r => ({
        ...r,
        [templateId]: { ok: false, message: e?.response?.data?.error || 'Failed to apply template.' },
      }));
    }
    setApplying(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Interview Templates</h1>
          <p className="text-gray-400 text-sm mt-1">
            {canEdit ? 'Create and manage reusable pipeline templates.' : 'Browse available pipeline templates.'}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="px-5 py-2.5 text-sm font-semibold text-gray-900 bg-yellow-400 hover:bg-yellow-300 rounded-xl transition-colors"
          >
            + New Template
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-xl mb-6">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-4 text-lg leading-none">×</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty state */}
      {!loading && templates.length === 0 && (
        <EmptyState
          icon={Layers}
          title="No templates yet"
          description="Create a reusable interview pipeline template."
          action={canEdit ? { label: 'New Template', onClick: openCreate } : undefined}
        />
      )}

      {/* Template cards */}
      {!loading && templates.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {templates.map(tpl => (
            <div key={tpl.id} className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden flex flex-col">
              {/* Card header */}
              <div className="p-5 border-b border-gray-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-white font-semibold text-base truncate">{tpl.name}</h2>
                    {tpl.department && (
                      <span className="inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full border bg-gray-700 text-yellow-400 border-yellow-700">
                        {tpl.department}
                      </span>
                    )}
                    {tpl.description && (
                      <p className="text-gray-400 text-sm mt-2 line-clamp-2">{tpl.description}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(tpl)}
                        className="px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-200 bg-blue-900/30 hover:bg-blue-900/60 rounded-lg transition-colors"
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(tpl.id, tpl.name)}
                        className="px-2.5 py-1.5 text-xs font-medium text-red-400 hover:text-red-200 bg-red-900/30 hover:bg-red-900/60 rounded-lg transition-colors"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Stages */}
              <div className="p-5 flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {tpl.stages?.length ?? 0} Stage{(tpl.stages?.length ?? 0) !== 1 ? 's' : ''}
                </p>
                {tpl.stages && tpl.stages.length > 0 ? (
                  <div className="space-y-2">
                    {tpl.stages.map((stage, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-gray-700 text-gray-400 text-xs flex items-center justify-center flex-shrink-0 font-bold">
                          {i + 1}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${stageTypeColors[stage.type as StageType] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                          {stageTypeLabel[stage.type as StageType] || stage.type}
                        </span>
                        {stage.description && (
                          <span className="text-gray-400 text-xs truncate">{stage.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-sm">No stages defined</p>
                )}
              </div>

              {/* Apply template section */}
              <div className="p-5 border-t border-gray-700 bg-gray-900/40">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Apply to Application</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={applyInput[tpl.id] || ''}
                    onChange={e => setApplyInput(prev => ({ ...prev, [tpl.id]: e.target.value }))}
                    placeholder="Application ID"
                    className="flex-1 min-w-0 px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                  />
                  <button
                    onClick={() => handleApply(tpl.id)}
                    disabled={applying === tpl.id || !(applyInput[tpl.id] || '').trim()}
                    className="px-3 py-2 text-xs font-semibold text-gray-900 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {applying === tpl.id ? 'Applying...' : 'Apply'}
                  </button>
                </div>
                {applyResult[tpl.id] && (
                  <p className={`text-xs mt-2 font-medium ${applyResult[tpl.id].ok ? 'text-green-400' : 'text-red-400'}`}>
                    {applyResult[tpl.id].ok ? '✓ ' : '✗ '}{applyResult[tpl.id].message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingId ? 'Edit Template' : 'New Template'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>

            {/* Modal body — scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {formError && (
                <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-xl text-sm">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">
                  Template Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Engineering Interview Pipeline"
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 text-sm"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Department</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  placeholder="e.g. Engineering, Product, Marketing"
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe what this template is for..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 text-sm resize-none"
                />
              </div>

              {/* Stages builder */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-gray-300">Stages</label>
                  <button
                    type="button"
                    onClick={addStage}
                    className="text-xs font-semibold text-yellow-400 hover:text-yellow-300 border border-yellow-700 hover:border-yellow-500 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    + Add Stage
                  </button>
                </div>

                {form.stages.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-gray-600 rounded-xl text-gray-500 text-sm">
                    No stages yet. Click "Add Stage" to begin.
                  </div>
                )}

                <div className="space-y-3">
                  {form.stages.map((stage, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-gray-900 border border-gray-700 rounded-xl p-4">
                      {/* Order label */}
                      <span className="w-6 h-6 rounded-full bg-gray-700 text-gray-400 text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 space-y-2">
                        {/* Type select */}
                        <select
                          value={stage.type}
                          onChange={e => updateStage(idx, { type: e.target.value as StageType })}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-yellow-500"
                        >
                          {STAGE_TYPES.map(t => (
                            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        {/* Description */}
                        <input
                          type="text"
                          value={stage.description}
                          onChange={e => updateStage(idx, { description: e.target.value })}
                          placeholder="Description (e.g. Coding round 1h)"
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-yellow-500"
                        />
                      </div>
                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeStage(idx)}
                        className="text-gray-500 hover:text-red-400 transition-colors mt-0.5 flex-shrink-0"
                        title="Remove stage"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                          <polyline points="3,6 5,6 21,6" />
                          <path d="M19,6l-1,14H6L5,6" />
                          <path d="M10,11v6" />
                          <path d="M14,11v6" />
                          <path d="M9,6V4h6v2" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-semibold text-gray-900 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 rounded-xl transition-colors"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
