import Editor from '@monaco-editor/react';

export interface CodeOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timestamp: number;
}

export interface CodeEditorPanelProps {
  code: string;
  language: 'javascript' | 'python';
  onCodeChange: (val: string | undefined) => void;
  onLanguageChange: (lang: 'javascript' | 'python') => void;
  onRunCode: () => void;
  codeOutput: CodeOutput | null;
  codeRunning: boolean;
  problem: string;
  onProblemChange: (val: string) => void;
  isNonCandidate: boolean;
  myRole: 'interviewer' | 'candidate';
}

function RunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function CodeEditorPanel({
  code,
  language,
  onCodeChange,
  onLanguageChange,
  onRunCode,
  codeOutput,
  codeRunning,
  problem,
  onProblemChange,
  isNonCandidate,
  myRole,
}: CodeEditorPanelProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Problem Statement section */}
      <details style={{ flexShrink: 0, borderBottom: '1px solid #1e2d40' }}>
        <summary style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px', cursor: 'pointer', background: '#0f172a',
          color: '#94a3b8', fontSize: 12, fontWeight: 500, userSelect: 'none',
        }}>
          <span>Problem Statement</span>
          <span style={{ color: '#475569' }}><ChevronDownIcon open={false} /></span>
        </summary>
        <div style={{ background: '#0a0f1a', padding: '8px 12px', height: 120, overflow: 'hidden' }}>
          {isNonCandidate ? (
            <textarea
              value={problem}
              onChange={e => onProblemChange(e.target.value)}
              placeholder="Type the problem statement here… Candidates will see it in real time."
              style={{
                width: '100%', height: '100%', background: '#0f172a', color: '#f1f5f9',
                border: '1px solid #1e2d40', borderRadius: 6, padding: '8px 10px',
                fontSize: 12, fontFamily: 'inherit', resize: 'none', lineHeight: 1.6,
                boxSizing: 'border-box', transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#1e2d40'; }}
            />
          ) : (
            problem ? (
              <pre style={{
                margin: 0, color: '#f1f5f9', fontSize: 12, fontFamily: 'inherit',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6,
                overflowY: 'auto', height: '100%',
              }}>{problem}</pre>
            ) : (
              <p style={{ margin: 0, color: '#475569', fontSize: 12, fontStyle: 'italic' }}>
                No problem statement set yet.
              </p>
            )
          )}
        </div>
      </details>

      {/* Toolbar */}
      <div style={{
        flexShrink: 0, height: 46, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px', background: '#0f172a', borderBottom: '1px solid #1e2d40',
      }}>
        <select
          value={language}
          onChange={e => onLanguageChange(e.target.value as 'javascript' | 'python')}
          disabled={myRole !== 'candidate'}
          style={{
            background: '#1e2d40', color: '#f1f5f9', border: '1px solid #1e2d40',
            borderRadius: 6, padding: '4px 10px', fontSize: 12,
            cursor: myRole === 'candidate' ? 'pointer' : 'default',
          }}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
        </select>

        <button
          className="run-btn"
          onClick={onRunCode}
          disabled={codeRunning}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: codeRunning ? '#374151' : '#22c55e',
            color: codeRunning ? '#94a3b8' : '#fff',
            border: 'none', borderRadius: 8, padding: '5px 14px',
            fontSize: 12, fontWeight: 600, cursor: codeRunning ? 'default' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          <RunIcon /> {codeRunning ? 'Running...' : 'Run'}
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#22c55e', display: 'inline-block',
            animation: 'blink 1.5s infinite',
          }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {myRole !== 'candidate' ? 'Live' : 'Synced'}
          </span>
        </div>
      </div>

      {/* Monaco editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Editor
          height="100%"
          language={language === 'python' ? 'python' : 'javascript'}
          value={code}
          onChange={myRole === 'candidate' ? onCodeChange : undefined}
          options={{
            readOnly: myRole !== 'candidate',
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            theme: 'vs-dark',
            padding: { top: 8 },
          }}
          theme="vs-dark"
        />
      </div>

      {/* Output pane */}
      <div style={{
        flexShrink: 0, height: 160, borderTop: '1px solid #1e2d40',
        background: '#020617', overflow: 'auto', padding: '8px 12px',
        fontFamily: 'monospace', fontSize: 12,
      }}>
        {!codeOutput && !codeRunning && (
          <span style={{ color: '#475569' }}>Output will appear here after running...</span>
        )}
        {codeRunning && (
          <span style={{ color: '#fbbf24' }}>Running...</span>
        )}
        {codeOutput && (
          <>
            {codeOutput.stdout && (
              <pre style={{ color: '#86efac', margin: 0, whiteSpace: 'pre-wrap' }}>{codeOutput.stdout}</pre>
            )}
            {codeOutput.stderr && (
              <pre style={{ color: '#fca5a5', margin: 0, whiteSpace: 'pre-wrap' }}>{codeOutput.stderr}</pre>
            )}
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block', padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: codeOutput.exitCode === 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: codeOutput.exitCode === 0 ? '#22c55e' : '#fca5a5',
                border: `1px solid ${codeOutput.exitCode === 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                exit {codeOutput.exitCode ?? 'killed'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
