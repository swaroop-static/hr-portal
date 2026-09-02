import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { getTestsPaginated, createTest, deleteTest } from '../../api';

interface Question {
  text: string;
  type: 'MCQ' | 'TEXT';
  options: string[];
  answer: string;
  order: number;
}

// ── Parse rows from Excel/CSV (header row optional) ──────────────────────────
function parseRows(rows: any[][]): Question[] {
  if (!rows.length) return [];
  // Skip header if first cell is non-numeric text like "Question"
  const first = String(rows[0]?.[0] || '').toLowerCase();
  const start = first.includes('question') || first.includes('q#') || first === 'q' ? 1 : 0;
  const out: Question[] = [];

  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    const text = String(row?.[0] ?? '').trim();
    if (!text) continue;

    const optA = String(row?.[1] ?? '').trim();
    const optB = String(row?.[2] ?? '').trim();
    const optC = String(row?.[3] ?? '').trim();
    const optD = String(row?.[4] ?? '').trim();
    const correctRaw = String(row?.[5] ?? '').trim().toUpperCase();
    const typeRaw = String(row?.[6] ?? '').trim().toUpperCase();

    const hasOptions = optA || optB || optC || optD;
    const type: 'MCQ' | 'TEXT' =
      typeRaw.startsWith('TEXT') || typeRaw.startsWith('WRITTEN') ? 'TEXT'
      : hasOptions ? 'MCQ' : 'TEXT';

    let answer = '0';
    if (correctRaw === 'B' || correctRaw === '2') answer = '1';
    else if (correctRaw === 'C' || correctRaw === '3') answer = '2';
    else if (correctRaw === 'D' || correctRaw === '4') answer = '3';

    out.push({
      text,
      type,
      options: type === 'MCQ'
        ? [optA || 'Option A', optB || 'Option B', optC || 'Option C', optD || 'Option D']
        : ['', '', '', ''],
      answer,
      order: out.length,
    });
  }
  return out;
}

function extractSheetId(url: string): string | null {
  const m = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

export default function Tests() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', duration: 30 });
  const [questions, setQuestions] = useState<Question[]>([
    { text: '', type: 'MCQ', options: ['', '', '', ''], answer: '0', order: 0 }
  ]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<Question[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);

  const load = (currentPage = page) => {
    setLoading(true);
    getTestsPaginated(currentPage, 20)
      .then(result => { setTests(result.data); setTotalPages(result.totalPages); })
      .catch(() => setError('Failed to load data. Please refresh.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, []);

  useEffect(() => {
    if (page !== 1) load(page);
  }, [page]);

  // ── Question CRUD ──────────────────────────────────────────────────────────
  const addQuestion = () =>
    setQuestions(q => [...q, { text: '', type: 'MCQ', options: ['', '', '', ''], answer: '0', order: q.length }]);

  const removeQuestion = (i: number) =>
    setQuestions(q => q.filter((_, idx) => idx !== i));

  const updateQuestion = (i: number, field: string, value: any) =>
    setQuestions(q => q.map((qu, idx) => idx === i ? { ...qu, [field]: value } : qu));

  const updateOption = (qi: number, oi: number, value: string) =>
    setQuestions(q => q.map((qu, idx) =>
      idx === qi ? { ...qu, options: qu.options.map((o, j) => j === oi ? value : o) } : qu));

  // ── Import: parse file ─────────────────────────────────────────────────────
  const handleFileUpload = (file: File) => {
    setImportError(null);
    setImportPreview(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        const parsed = parseRows(rows);
        if (!parsed.length) { setImportError('No questions found. Check the file format.'); return; }
        setImportPreview(parsed);
      } catch {
        setImportError('Could not read file. Make sure it is a valid Excel or CSV file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // ── Import: fetch Google Sheets CSV ───────────────────────────────────────
  const handleImportUrl = async () => {
    setImportError(null);
    setImportPreview(null);
    setImportLoading(true);
    try {
      const id = extractSheetId(importUrl);
      if (!id) throw new Error('Could not find a Google Sheets ID in that URL. Make sure you paste the full sharing link.');
      const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`;
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error('Could not fetch the sheet. Make sure it is shared as "Anyone with the link can view".');
      const csv = await res.text();
      const wb = XLSX.read(csv, { type: 'string' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
      const parsed = parseRows(rows);
      if (!parsed.length) throw new Error('No questions found. Check the sheet format.');
      setImportPreview(parsed);
    } catch (e: any) {
      setImportError(e.message || 'Import failed.');
    }
    setImportLoading(false);
  };

  // ── Confirm import → populate manual tab ─────────────────────────────────
  const confirmImport = () => {
    if (!importPreview) return;
    setQuestions(importPreview);
    setImportPreview(null);
    setImportUrl('');
    setActiveTab('manual');
  };

  // ── Download template xlsx ────────────────────────────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer (A/B/C/D)', 'Type (MCQ/TEXT)'],
      ['What is 2 + 2?', '3', '4', '5', '6', 'B', 'MCQ'],
      ['Which is a JavaScript framework?', 'Django', 'React', 'Flask', 'Laravel', 'B', 'MCQ'],
      ['Which HTTP method is used to create a resource?', 'GET', 'POST', 'PUT', 'DELETE', 'B', 'MCQ'],
      ['Explain the concept of REST APIs.', '', '', '', '', '', 'TEXT'],
    ]);
    // Column widths
    ws['!cols'] = [{ wch: 45 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 26 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');
    XLSX.writeFile(wb, 'test_questions_template.xlsx');
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createTest({
        ...form,
        questions: questions.map((q, i) => ({
          text: q.text,
          type: q.type,
          options: q.type === 'MCQ' ? q.options : null,
          answer: q.type === 'MCQ' ? q.answer : null,
          order: i,
        }))
      });
      setShowModal(false);
      setForm({ title: '', description: '', duration: 30 });
      setQuestions([{ text: '', type: 'MCQ', options: ['', '', '', ''], answer: '0', order: 0 }]);
      setActiveTab('manual');
      setImportPreview(null);
      setPage(1);
      load(1);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to create test.');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this test? This cannot be undone.')) return;
    try { await deleteTest(id); setPage(1); load(1); } catch {}
  };

  const openModal = () => {
    setError(null);
    setImportError(null);
    setImportPreview(null);
    setImportUrl('');
    setActiveTab('manual');
    setShowModal(true);
  };

  return (
    <div className="p-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessment Tests</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage candidate tests</p>
        </div>
        <button onClick={openModal}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold shadow-md hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5a9e)' }}>
          + Create Test
        </button>
      </div>

      <div ref={listRef}>
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading tests...</div>
        ) : tests.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-gray-500 font-medium">No tests created yet</p>
            <button onClick={openModal} className="mt-4 px-5 py-2 text-white rounded-lg text-sm font-semibold" style={{ background: '#1e3a5f' }}>
              Create First Test
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {tests.map(test => (
              <div key={test.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-0.5">
                    <h3 className="font-semibold text-gray-900">{test.title}</h3>
                    {test.createdBy && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        by {test.createdBy.name} ({test.createdBy.role})
                      </span>
                    )}
                  </div>
                  {test.description && <p className="text-sm text-gray-400 mt-0.5">{test.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
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
      </div>

      {/* Pagination bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => { setPage(p => p - 1); listRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
            disabled={page <= 1}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page <span className="text-gray-900 font-semibold">{page}</span> of <span className="text-gray-900 font-semibold">{totalPages}</span>
          </span>
          <button
            onClick={() => { setPage(p => p + 1); listRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
            disabled={page >= totalPages}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            Next
          </button>
        </div>
      )}

      {/* ── Create Test Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">

            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">Create New Test</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                <button onClick={() => setActiveTab('manual')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  ✏️ Manual
                </button>
                <button onClick={() => setActiveTab('import')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'import' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  📥 Import
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-5 space-y-5">

                {/* Test info — always visible */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Test Title</label>
                    <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="e.g. React Developer Assessment" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Duration (minutes)</label>
                    <input type="number" min={5} value={form.duration} onChange={e => setForm({ ...form, duration: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description (optional)</label>
                    <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
                      placeholder="Brief description" />
                  </div>
                </div>

                {/* ── IMPORT TAB ─────────────────────────────────────────── */}
                {activeTab === 'import' && (
                  <div className="space-y-5">

                    {/* Format guide */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-sm font-semibold text-blue-800 mb-2">Expected column order</p>
                      <div className="overflow-x-auto">
                        <table className="text-xs text-blue-700 w-full">
                          <thead>
                            <tr className="border-b border-blue-200">
                              {['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct (A/B/C/D)', 'Type (MCQ/TEXT)'].map(h => (
                                <th key={h} className="text-left pb-1 pr-3 font-semibold whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="text-blue-600">
                              <td className="pr-3 py-1">What is 2+2?</td>
                              <td className="pr-3">3</td><td className="pr-3">4</td><td className="pr-3">5</td><td className="pr-3">6</td>
                              <td className="pr-3">B</td><td>MCQ</td>
                            </tr>
                            <tr className="text-blue-600">
                              <td className="pr-3 py-1">Explain REST...</td>
                              <td colSpan={4} className="text-blue-400 pr-3">(leave blank)</td>
                              <td className="text-blue-400 pr-3"></td><td>TEXT</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <button type="button" onClick={downloadTemplate}
                        className="mt-3 text-xs text-blue-700 font-semibold hover:underline flex items-center gap-1">
                        ⬇ Download template (.xlsx)
                      </button>
                    </div>

                    {/* File upload */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Upload Excel or CSV file</p>
                      <div
                        onClick={() => fileRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
                        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all">
                        <div className="text-3xl mb-2">📄</div>
                        <p className="text-sm font-medium text-gray-600">Drag & drop or click to upload</p>
                        <p className="text-xs text-gray-400 mt-1">.xlsx, .xls, .csv — Google Sheets exported as any of these</p>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
                      </div>
                    </div>

                    {/* Google Sheets URL */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Or paste a Google Sheets URL</p>
                      <p className="text-xs text-gray-400 mb-2">Sheet must be shared as "Anyone with the link can view"</p>
                      <div className="flex gap-2">
                        <input value={importUrl} onChange={e => setImportUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
                        <button type="button" onClick={handleImportUrl} disabled={!importUrl.trim() || importLoading}
                          className="px-4 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-all"
                          style={{ background: '#1e3a5f' }}>
                          {importLoading ? '⏳' : 'Fetch'}
                        </button>
                      </div>
                    </div>

                    {importError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{importError}</div>
                    )}

                    {/* Preview */}
                    {importPreview && (
                      <div className="border border-green-200 bg-green-50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold text-green-800">
                            ✅ {importPreview.length} question{importPreview.length !== 1 ? 's' : ''} found
                          </p>
                          <button type="button" onClick={confirmImport}
                            className="px-4 py-1.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-all">
                            Use These Questions →
                          </button>
                        </div>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {importPreview.map((q, i) => (
                            <div key={i} className="bg-white rounded-lg px-3 py-2 text-xs border border-green-100">
                              <span className="font-semibold text-gray-500 mr-2">Q{i + 1}.</span>
                              <span className="text-gray-700">{q.text}</span>
                              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${q.type === 'MCQ' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>{q.type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── MANUAL TAB ─────────────────────────────────────────── */}
                {activeTab === 'manual' && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-700">Questions ({questions.length})</label>
                      <button type="button" onClick={addQuestion}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg">
                        + Add Question
                      </button>
                    </div>
                    <div className="space-y-4">
                      {questions.map((q, qi) => (
                        <div key={qi} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-semibold text-gray-600">Q{qi + 1}</span>
                            {questions.length > 1 && (
                              <button type="button" onClick={() => removeQuestion(qi)}
                                className="text-xs text-red-500 hover:text-red-700">Remove</button>
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
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Options — click radio to set correct</p>
                                {q.options.map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    <input type="radio" name={`correct-${qi}`} checked={q.answer === String(oi)}
                                      onChange={() => updateQuestion(qi, 'answer', String(oi))}
                                      className="cursor-pointer" />
                                    <input value={opt} onChange={e => updateOption(qi, oi, e.target.value)}
                                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"
                                      placeholder={`Option ${String.fromCharCode(65 + oi)}`} required />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex justify-end gap-3 sticky bottom-0 bg-white pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">
                  Cancel
                </button>
                <button type="submit" disabled={saving || activeTab === 'import'}
                  title={activeTab === 'import' ? 'Confirm the import first to use those questions' : ''}
                  className="px-5 py-2.5 text-sm font-medium text-white rounded-xl disabled:opacity-50 transition-all"
                  style={{ background: '#1e3a5f' }}>
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
