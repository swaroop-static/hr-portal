interface SkillScore {
  label: string;
  score: number;
}

export default function SkillRadarChart({ skills }: { skills: SkillScore[] }) {
  if (skills.length < 3) return null;

  const cx = 160, cy = 160, r = 110;
  const n = skills.length;
  const startAngle = -Math.PI / 2;
  const step = (2 * Math.PI) / n;

  const polar = (i: number, value: number) => {
    const a = startAngle + i * step;
    const d = (value / 100) * r;
    return { x: cx + d * Math.cos(a), y: cy + d * Math.sin(a) };
  };

  const edgePoint = (i: number) => {
    const a = startAngle + i * step;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  const labelPoint = (i: number) => {
    const a = startAngle + i * step;
    const d = r + 28;
    return { x: cx + d * Math.cos(a), y: cy + d * Math.sin(a) };
  };

  const textAnchor = (i: number) => {
    const a = startAngle + i * step;
    const x = Math.cos(a);
    if (x > 0.3) return 'start';
    if (x < -0.3) return 'end';
    return 'middle';
  };

  const ringPoints = (pct: number) =>
    skills.map((_, i) => { const p = polar(i, pct); return `${p.x},${p.y}`; }).join(' ');

  const dataPoints = skills.map((s, i) => { const p = polar(i, s.score); return `${p.x},${p.y}`; }).join(' ');

  const avg = skills.reduce((a, s) => a + s.score, 0) / skills.length;
  const fill = avg >= 70 ? 'rgba(59,130,246,0.18)' : avg >= 50 ? 'rgba(251,191,36,0.2)' : 'rgba(248,113,113,0.18)';
  const stroke = avg >= 70 ? '#3b82f6' : avg >= 50 ? '#f59e0b' : '#ef4444';
  const dotColor = stroke;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg width="320" height="320" viewBox="0 0 320 320">
        {/* Grid rings */}
        {[25, 50, 75, 100].map(pct => (
          <polygon key={pct} points={ringPoints(pct)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        ))}
        {/* Ring labels */}
        {[25, 50, 75].map(pct => (
          <text key={pct} x={cx + 3} y={cy - (pct / 100) * r + 4} fontSize="9" fill="#9ca3af">{pct}%</text>
        ))}

        {/* Axis lines */}
        {skills.map((_, i) => {
          const e = edgePoint(i);
          return <line key={i} x1={cx} y1={cy} x2={e.x} y2={e.y} stroke="#e5e7eb" strokeWidth="1" />;
        })}

        {/* Data polygon */}
        <polygon points={dataPoints} fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />

        {/* Data dots */}
        {skills.map((s, i) => {
          const p = polar(i, s.score);
          return <circle key={i} cx={p.x} cy={p.y} r="4" fill={dotColor} stroke="white" strokeWidth="1.5" />;
        })}

        {/* Labels */}
        {skills.map((s, i) => {
          const lp = labelPoint(i);
          const scoreP = polar(i, s.score);
          const anchor = textAnchor(i);
          const scoreColor = s.score >= 70 ? '#16a34a' : s.score >= 50 ? '#d97706' : '#dc2626';
          return (
            <g key={i}>
              <text x={lp.x} y={lp.y - 6} textAnchor={anchor} fontSize="11" fontWeight="700" fill="#111827">{s.label}</text>
              <text x={lp.x} y={lp.y + 8} textAnchor={anchor} fontSize="10" fontWeight="600" fill={scoreColor}>{s.score}%</text>
              {/* Score bubble near dot */}
              <text x={scoreP.x} y={scoreP.y - 9} textAnchor="middle" fontSize="9" fill={dotColor} fontWeight="700">
                {s.score}
              </text>
            </g>
          );
        })}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r="3" fill="#d1d5db" />
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center' }}>
        {skills.map(s => {
          const c = s.score >= 70 ? '#16a34a' : s.score >= 50 ? '#d97706' : '#dc2626';
          const bg = s.score >= 70 ? '#f0fdf4' : s.score >= 50 ? '#fffbeb' : '#fef2f2';
          const label = s.score >= 70 ? 'Strong' : s.score >= 50 ? 'Average' : 'Needs work';
          return (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, background: bg, border: `1px solid ${c}30`, borderRadius: 6, padding: '3px 10px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{s.label}</span>
              <span style={{ fontSize: 11, color: c, fontWeight: 700 }}>{s.score}% · {label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
