import React from 'react';

export interface WhiteboardPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  wbTool: 'pen' | 'rect' | 'ellipse' | 'arrow' | 'eraser';
  wbColor: string;
  wbSize: number;
  onToolChange: (tool: 'pen' | 'rect' | 'ellipse' | 'arrow' | 'eraser') => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onClear: () => void;
  onUndo: () => void;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: () => void;
}

const WB_COLORS = ['#FACC15', '#ffffff', '#f87171', '#34d399', '#60a5fa', '#a78bfa', '#fb923c'];
const WB_SIZES = [2, 4, 6, 10, 16];

export default function WhiteboardPanel({
  canvasRef,
  wbTool,
  wbColor,
  wbSize,
  onToolChange,
  onColorChange,
  onSizeChange,
  onClear,
  onUndo,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: WhiteboardPanelProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Whiteboard toolbar */}
      <div style={{
        flexShrink: 0, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
        padding: '8px 12px', background: '#0f172a', borderBottom: '1px solid #1e2d40',
      }}>
        {/* Tool buttons */}
        {(['pen', 'rect', 'ellipse', 'arrow', 'eraser'] as const).map(t => (
          <button
            key={t}
            onClick={() => onToolChange(t)}
            style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 12, border: '1px solid',
              background: wbTool === t ? 'var(--gold)' : 'transparent',
              color: wbTool === t ? '#000' : 'var(--text-primary)',
              borderColor: wbTool === t ? 'var(--gold)' : 'rgba(255,255,255,0.2)',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}

        {/* Color swatches */}
        {WB_COLORS.map(c => (
          <button
            key={c}
            onClick={() => onColorChange(c)}
            style={{
              width: 18, height: 18, borderRadius: '50%', background: c, cursor: 'pointer',
              border: wbColor === c ? '2px solid white' : '2px solid transparent',
            }}
          />
        ))}

        {/* Size selector */}
        <select
          value={wbSize}
          onChange={e => onSizeChange(Number(e.target.value))}
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            color: 'var(--text-primary)', borderRadius: 4, padding: '2px 4px', fontSize: 12,
          }}
        >
          {WB_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
        </select>

        {/* Clear button */}
        <button
          onClick={onClear}
          style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
            background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171',
          }}
        >
          Clear
        </button>

        {/* Undo button */}
        <button
          onClick={onUndo}
          style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
            background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24',
          }}
        >
          Undo
        </button>
      </div>

      {/* Canvas */}
      <div style={{
        flex: 1, overflow: 'auto', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center',
        padding: 12, background: '#0a0f1a',
      }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{
            width: '100%', height: 'auto', background: '#1a1a2e',
            borderRadius: 8, cursor: wbTool === 'eraser' ? 'cell' : 'crosshair', display: 'block',
          }}
        />
      </div>
    </div>
  );
}
