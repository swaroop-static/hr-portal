export interface ScorecardState {
  categories: { name: string; score: number }[];
  recommendation: string;
  overallNotes: string;
}

export interface ScorecardModalProps {
  scorecard: ScorecardState;
  onScorecardChange: (updated: ScorecardState) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export default function ScorecardModal({
  scorecard,
  onScorecardChange,
  onSubmit,
  onSkip,
  onBack,
  isSubmitting,
}: ScorecardModalProps) {
  const isDisabled =
    isSubmitting ||
    !scorecard.recommendation ||
    scorecard.categories.some(c => c.score === 0);

  const handleStarClick = (idx: number, star: number) => {
    onScorecardChange({
      ...scorecard,
      categories: scorecard.categories.map((c, i) =>
        i === idx ? { ...c, score: star } : c
      ),
    });
  };

  const handleRecommendationChange = (value: string) => {
    onScorecardChange({ ...scorecard, recommendation: value });
  };

  const handleNotesChange = (value: string) => {
    onScorecardChange({ ...scorecard, overallNotes: value.slice(0, 500) });
  };

  return (
    <>
      <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16, margin: '0 0 16px' }}>
        Interview Scorecard
      </h2>

      {/* Star rating rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {scorecard.categories.map((cat, idx) => (
          <div
            key={cat.name}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span style={{ color: '#94a3b8', fontSize: 13, minWidth: 130 }}>{cat.name}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => handleStarClick(idx, star)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px',
                    fontSize: 20, lineHeight: 1,
                    color: star <= cat.score ? '#FACC15' : 'rgba(255,255,255,0.2)',
                    transition: 'color 0.1s',
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recommendation dropdown */}
      <div style={{ marginBottom: 12 }}>
        <label style={{
          display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, fontWeight: 500,
        }}>
          Recommendation
        </label>
        <select
          value={scorecard.recommendation}
          onChange={e => handleRecommendationChange(e.target.value)}
          style={{
            width: '100%', background: '#111827',
            color: scorecard.recommendation ? '#f1f5f9' : '#64748b',
            border: '1px solid #1e2d40', borderRadius: 8, padding: '8px 12px',
            fontSize: 13, boxSizing: 'border-box',
          }}
        >
          <option value="">Select recommendation</option>
          <option value="Strong Hire">Strong Hire</option>
          <option value="Hire">Hire</option>
          <option value="No Hire">No Hire</option>
          <option value="Strong No Hire">Strong No Hire</option>
        </select>
      </div>

      {/* Overall notes */}
      <div style={{ marginBottom: 18 }}>
        <label style={{
          display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 5, fontWeight: 500,
        }}>
          Overall Notes{' '}
          <span style={{ color: '#475569', fontWeight: 400 }}>(optional, max 500 chars)</span>
        </label>
        <textarea
          value={scorecard.overallNotes}
          onChange={e => handleNotesChange(e.target.value)}
          rows={3}
          placeholder="Overall notes (optional)..."
          style={{
            width: '100%', background: '#111827', color: '#f1f5f9',
            border: '1px solid #1e2d40', borderRadius: 8, padding: '8px 12px',
            fontSize: 13, resize: 'none', boxSizing: 'border-box', lineHeight: 1.6,
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#1e2d40'; }}
        />
        <div style={{ textAlign: 'right', fontSize: 11, color: '#475569', marginTop: 2 }}>
          {scorecard.overallNotes.length}/500
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <button
          onClick={onSubmit}
          disabled={isDisabled}
          style={{
            flex: 1, padding: '10px 0',
            background: isDisabled ? '#374151' : '#FACC15',
            color: isDisabled ? '#94a3b8' : '#000',
            border: 'none', borderRadius: 8,
            cursor: isDisabled ? 'default' : 'pointer',
            fontWeight: 700, fontSize: 13,
            opacity: isSubmitting ? 0.7 : 1,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Scorecard & End'}
        </button>
        <button
          onClick={onBack}
          style={{
            padding: '10px 16px', background: '#1e2d40', color: '#f1f5f9',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}
        >
          Back
        </button>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={onSkip}
          style={{
            background: 'transparent', color: '#475569', border: 'none',
            cursor: 'pointer', fontSize: 12, padding: '4px 0',
          }}
        >
          Skip &amp; End without submitting
        </button>
      </div>
    </>
  );
}
