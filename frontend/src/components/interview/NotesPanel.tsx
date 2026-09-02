export interface NotesPanelProps {
  liveNotes: string;
  onNotesChange: (val: string) => void;
  notesSaving: 'idle' | 'saving' | 'saved';
  isNonCandidate: boolean;
}

export default function NotesPanel({ liveNotes, onNotesChange, notesSaving, isNonCandidate: _isNonCandidate }: NotesPanelProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px', gap: 8, overflow: 'hidden' }}>
      <p style={{ margin: 0, fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
        Private notes — only visible to you
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{
          fontSize: 11,
          color: notesSaving === 'saving' ? '#fbbf24' : notesSaving === 'saved' ? '#22c55e' : '#475569',
        }}>
          {notesSaving === 'saving' ? 'Saving...' : notesSaving === 'saved' ? '✓ Saved' : 'Auto-saves on change'}
        </span>
      </div>
      <textarea
        value={liveNotes}
        onChange={e => onNotesChange(e.target.value)}
        placeholder="Type your interview notes here... (auto-saved)"
        style={{
          flex: 1, background: '#0f172a', color: '#f1f5f9',
          border: '1px solid #1e2d40', borderRadius: 8, padding: 12,
          fontSize: 13, fontFamily: 'inherit', resize: 'none', lineHeight: 1.6,
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
        onBlur={e => { e.currentTarget.style.borderColor = '#1e2d40'; }}
      />
    </div>
  );
}
