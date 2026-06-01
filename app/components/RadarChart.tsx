'use client';

import { useState } from 'react';

const SKILLS = ['energy','intelligence','strength','bravery','wealth','discipline','wisdom','influence'];
const ICONS: Record<string, string> = {
  energy: '⚡', intelligence: '🧠', strength: '💪', bravery: '🛡️',
  wealth: '💰', discipline: '⚔️', wisdom: '📖', influence: '🌐',
};
// Minimum display radius so even 0-XP skills show a tiny shape on a new account
const BASELINE = 20;

export default function RadarChart({ stats }: { stats: Record<string, number> }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const n = SKILLS.length;
  const maxVal = 6000;

  function getAngle(i: number) { return (i * 2 * Math.PI) / n - Math.PI / 2; }

  function getPoint(i: number, val: number) {
    const angle = getAngle(i);
    const scaled = (Math.max(val, BASELINE) / maxVal) * r;
    return { x: cx + scaled * Math.cos(angle), y: cy + scaled * Math.sin(angle) };
  }

  function getOuterPoint(i: number) {
    const angle = getAngle(i);
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function getLabelPoint(i: number) {
    const angle = getAngle(i);
    const labelR = r * 1.32;
    return { x: cx + labelR * Math.cos(angle), y: cy + labelR * Math.sin(angle) };
  }

  const dataPoints = SKILLS.map((s, i) => getPoint(i, stats[s] || 0));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
  const levels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="relative" style={{ maxWidth: 260, margin: '0 auto' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        {/* Grid levels */}
        {levels.map(level => {
          const pts = SKILLS.map((_, i) => getPoint(i, maxVal * level));
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
          return <path key={level} d={path} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
        })}

        {/* Spoke lines */}
        {SKILLS.map((_, i) => {
          const outer = getOuterPoint(i);
          return <line key={i} x1={cx} y1={cy} x2={outer.x.toFixed(1)} y2={outer.y.toFixed(1)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
        })}

        {/* Data fill */}
        <path d={dataPath} fill="rgba(175,198,255,0.15)" stroke="#afc6ff" strokeWidth="2" strokeLinejoin="round" />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3" fill="#afc6ff" />
        ))}

        {/* Labels + invisible hit areas */}
        {SKILLS.map((s, i) => {
          const lp = getLabelPoint(i);
          const isHovered = hovered === s;
          return (
            <g key={i}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}>
              <rect
                x={(lp.x - 22).toFixed(1)} y={(lp.y - 10).toFixed(1)}
                width="44" height="20" fill="transparent" />
              <text
                x={lp.x.toFixed(1)} y={lp.y.toFixed(1)}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="7.5"
                fill={isHovered ? '#afc6ff' : '#8c90a1'}
                fontFamily="Inter, sans-serif"
                style={{ transition: 'fill 0.15s', userSelect: 'none' }}>
                {ICONS[s]} {s.slice(0, 3).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (() => {
        const idx = SKILLS.indexOf(hovered);
        const lp = getLabelPoint(idx);
        const xPct = lp.x / size;
        const yPct = lp.y / size;
        const xp = stats[hovered] || 0;
        return (
          <div
            className="absolute pointer-events-none z-10 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap animate-fade-in"
            style={{
              left: `${xPct * 100}%`,
              top: `${yPct * 100}%`,
              transform: 'translate(-50%, -130%)',
              background: 'rgba(31,31,37,0.97)',
              border: '1px solid rgba(175,198,255,0.25)',
              color: '#e4e1e9',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>
            {ICONS[hovered]} {hovered.charAt(0).toUpperCase() + hovered.slice(1)}
            <span className="ml-1.5 font-normal" style={{ color: '#afc6ff' }}>{xp} XP</span>
          </div>
        );
      })()}
    </div>
  );
}
