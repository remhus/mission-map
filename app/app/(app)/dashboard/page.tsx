'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const CapsuleEditor = dynamic(() => import('@/components/RichEditor'), { ssr: false });

type Cell = { row_index: number; col_index: number; content: string; cell_type: string };
type Task = { id: number; title: string; skill: string; duration_minutes: number; time_of_day: string | null; day_of_week: number; every_day: boolean; is_completed: boolean; completed_at: string | null };

// --- Grid logic ---

// The 8 pillar positions in the center sub-grid, clockwise from top-left
// Maps center-grid cell → outer sub-grid center it mirrors to
const PILLAR_TO_OUTER: Record<string, [number, number]> = {
  '3,3': [1, 1], '3,4': [1, 4], '3,5': [1, 7],
  '4,5': [4, 7], '5,5': [7, 7], '5,4': [7, 4],
  '5,3': [7, 1], '4,3': [4, 1],
};

// Reverse: outer sub-grid center → the pillar it mirrors from
const OUTER_TO_PILLAR: Record<string, [number, number]> = {};
Object.entries(PILLAR_TO_OUTER).forEach(([k, v]) => {
  OUTER_TO_PILLAR[`${v[0]},${v[1]}`] = k.split(',').map(Number) as [number, number];
});

function isUltimate(r: number, c: number) { return r === 4 && c === 4; }
function isCenterPillar(r: number, c: number) { return r >= 3 && r <= 5 && c >= 3 && c <= 5 && !isUltimate(r, c); }
function isOuterCenter(r: number, c: number) { return r % 3 === 1 && c % 3 === 1 && !isUltimate(r, c); }
function isInCenterGrid(r: number, c: number) { return r >= 3 && r <= 5 && c >= 3 && c <= 5; }

// Get the content an outer center should display (mirrors its source pillar)
function getOuterCenterContent(r: number, c: number, cells: Cell[][]): string {
  const src = OUTER_TO_PILLAR[`${r},${c}`];
  if (!src) return '';
  return cells[src[0]]?.[src[1]]?.content || '';
}

// Is an outer task cell unlocked? Only if ultimate goal AND its pillar both have content
function isOuterTaskUnlocked(r: number, c: number, cells: Cell[][]): boolean {
  if (!cells[4]?.[4]?.content?.trim()) return false;
  const sgCenterR = Math.floor(r / 3) * 3 + 1;
  const sgCenterC = Math.floor(c / 3) * 3 + 1;
  const pillarContent = getOuterCenterContent(sgCenterR, sgCenterC, cells);
  return pillarContent.trim().length > 0;
}

// What role does a cell visually play
function getCellRole(r: number, c: number): 'ultimate' | 'pillar' | 'outer-center' | 'task' {
  if (isUltimate(r, c)) return 'ultimate';
  if (isCenterPillar(r, c)) return 'pillar';
  if (isOuterCenter(r, c)) return 'outer-center';
  return 'task';
}

const SKILL_ICONS: Record<string, string> = {
  energy: 'bolt', intelligence: 'psychology', strength: 'fitness_center',
  bravery: 'shield', wealth: 'payments', discipline: 'military_tech',
  wisdom: 'auto_stories', influence: 'public',
};

function GridCell({
  r, c, cells, onEdit, fullscreen, half,
}: {
  r: number; c: number; cells: Cell[][];
  onEdit: (r: number, c: number) => void;
  fullscreen: boolean; half: boolean;
}) {
  const role = getCellRole(r, c);
  const isOC = role === 'outer-center';
  const isCG = isInCenterGrid(r, c);
  const displayContent = isOC ? getOuterCenterContent(r, c, cells) : cells[r][c].content;
  const ultimateFilled = cells[4]?.[4]?.content?.trim().length > 0;
  const locked =
    (role === 'pillar' && !ultimateFilled) ||
    (role === 'task' && !isCG && !isOuterTaskUnlocked(r, c, cells));
  const editable = !isOC && !locked;

  const fs = fullscreen ? 'clamp(5px, 1.2vmin, 14px)' : half ? 'clamp(4px, 0.85vmin, 9px)' : 'clamp(5px, 0.85vw, 10px)';
  const br = fullscreen ? '3px' : 'clamp(2px, 0.5vw, 6px)';

  let style: React.CSSProperties = {
    borderRadius: br,
    cursor: editable ? 'pointer' : 'default',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', position: 'relative', minWidth: 0,
    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
    fontSize: fs, fontWeight: 600, lineHeight: 1.2,
    textAlign: 'center', padding: '2px',
  };

  if (role === 'ultimate') {
    style = { ...style, background: 'rgba(255,215,0,0.12)', border: '2px solid rgba(255,215,0,0.6)', boxShadow: '0 0 30px rgba(255,215,0,0.25)', color: '#ffd700' };
  } else if (role === 'pillar') {
    style = { ...style, background: 'rgba(175,198,255,0.08)', border: '1px solid rgba(175,198,255,0.4)', color: '#afc6ff' };
  } else if (isOC) {
    style = { ...style, background: displayContent ? 'rgba(175,198,255,0.06)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(175,198,255,0.25)', color: '#afc6ff' };
  } else if (locked) {
    style = { ...style, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.12)', cursor: 'not-allowed' };
  } else {
    style = { ...style, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#c1c6d8' };
  }

  return (
    <div key={`${r}-${c}`} style={style}
      onClick={() => { if (editable) onEdit(r, c); }}
      onMouseEnter={e => {
        if (!editable || isOC) return;
        (e.currentTarget as HTMLElement).style.background =
          role === 'ultimate' ? 'rgba(255,215,0,0.18)' :
          role === 'pillar' ? 'rgba(175,198,255,0.15)' :
          'rgba(255,255,255,0.07)';
      }}
      onMouseLeave={e => {
        if (!editable || isOC) return;
        (e.currentTarget as HTMLElement).style.background =
          role === 'ultimate' ? 'rgba(255,215,0,0.12)' :
          role === 'pillar' ? 'rgba(175,198,255,0.08)' :
          'rgba(255,255,255,0.03)';
      }}>
      {displayContent ? (
        <span style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', wordBreak: 'normal', overflowWrap: 'normal', boxSizing: 'border-box' }}>
          {displayContent}
        </span>
      ) : isOC ? (
        <span className="material-symbols-outlined" style={{ fontSize: fullscreen ? 'clamp(6px, 1vmin, 12px)' : half ? 'clamp(4px, 0.45vw, 6px)' : 'clamp(6px, 0.9vw, 10px)', color: 'rgba(175,198,255,0.15)' }}>link</span>
      ) : locked ? (
        <span className="material-symbols-outlined" style={{ fontSize: fullscreen ? 'clamp(5px, 0.9vmin, 10px)' : half ? 'clamp(4px, 0.35vw, 5px)' : 'clamp(5px, 0.7vw, 8px)', color: 'rgba(255,255,255,0.08)' }}>lock</span>
      ) : role === 'ultimate' ? (
        <span className="material-symbols-outlined" style={{ fontSize: fullscreen ? 'clamp(10px, 2vmin, 22px)' : half ? 'clamp(6px, 1vw, 12px)' : 'clamp(10px, 2vw, 22px)', fontVariationSettings: "'FILL' 1", color: 'rgba(255,215,0,0.4)' }}>workspace_premium</span>
      ) : (
        <span className="material-symbols-outlined" style={{ fontSize: fullscreen ? 'clamp(6px, 1vmin, 12px)' : half ? 'clamp(4px, 0.5vw, 7px)' : 'clamp(6px, 1vw, 12px)', color: 'rgba(255,255,255,0.12)' }}>add</span>
      )}
    </div>
  );
}

function GridView({
  cells, onEdit, fullscreen = false, half = false,
}: {
  cells: Cell[][];
  onEdit: (r: number, c: number) => void;
  fullscreen?: boolean;
  half?: boolean;
}) {
  // Render as a 3×3 of sub-grids so there's a visible gap between each block
  const outerGap = fullscreen ? '5px' : 'clamp(3px, 0.6vw, 8px)';
  const innerGap = fullscreen ? '2px' : 'clamp(1px, 0.25vw, 3px)';

  return (
    <div className="w-full h-full grid"
      style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: outerGap }}>
      {[0, 1, 2].map(sgr =>
        [0, 1, 2].map(sgc => {
          const isCenter = sgr === 1 && sgc === 1;
          return (
            <div key={`sg-${sgr}-${sgc}`}
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridTemplateRows: 'repeat(3, 1fr)',
                gap: innerGap,
                borderRadius: fullscreen ? '4px' : 'clamp(3px, 0.6vw, 8px)',
                padding: fullscreen ? '2px' : 'clamp(1px, 0.2vw, 3px)',
                background: isCenter
                  ? 'rgba(175,198,255,0.04)'
                  : 'rgba(255,255,255,0.015)',
                border: isCenter
                  ? '1px solid rgba(175,198,255,0.12)'
                  : '1px solid rgba(255,255,255,0.04)',
              }}>
              {[0, 1, 2].map(lr =>
                [0, 1, 2].map(lc => (
                  <GridCell
                    key={`${sgr * 3 + lr}-${sgc * 3 + lc}`}
                    r={sgr * 3 + lr}
                    c={sgc * 3 + lc}
                    cells={cells}
                    onEdit={onEdit}
                    fullscreen={fullscreen}
                    half={half}
                  />
                ))
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

type DreamCapsule = { id: number; content: string | null; is_sealed: boolean; sealed_at: string | null; locked_until: string | null; created_at: string };

function formatCountdown(lockedUntil: string, now: number): string {
  const diff = new Date(lockedUntil).getTime() - now;
  if (diff <= 0) return 'Ready to open';
  const days = Math.floor(diff / 86400000);
  const yrs = Math.floor(days / 365);
  const mos = Math.floor((days % 365) / 30);
  const d = days % 30;
  return [yrs > 0 && `${yrs}y`, mos > 0 && `${mos}mo`, (d > 0 || (!yrs && !mos)) && `${d}d`]
    .filter(Boolean).join(' ');
}

const SKILL_COLORS: Record<string, string> = { energy:'#ffd700',intelligence:'#afc6ff',strength:'#ff6b6b',bravery:'#c3f400',wealth:'#4ecdc4',discipline:'#e9b3ff',wisdom:'#f97316',influence:'#fd79a8' };

function TomorrowSection({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return null;
  return (
    <div className="hidden md:block mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#414655' }}>Tomorrow</p>
      <div className="flex flex-col gap-2">
        {tasks.map(task => {
          const color = SKILL_COLORS[task.skill] || '#afc6ff';
          return (
            <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${color}40` }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: '#6b7280' }}>{task.title}</p>
                <p className="text-xs mt-0.5" style={{ color: '#414655' }}>
                  <span style={{ color: color + '80' }}>{task.skill}</span>
                  {' · '}{task.duration_minutes}m
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<Task[]>([]);
  const [capsule, setCapsule] = useState<DreamCapsule | null | undefined>(undefined);
  const [showCapsule, setShowCapsule] = useState(false);
  const [capsuleStep, setCapsuleStep] = useState<'write' | 'timeframe' | 'confirm' | 'read'>('write');
  const [capsuleContent, setCapsuleContent] = useState('');
  const [capsuleId, setCapsuleId] = useState<number | null>(null);
  const [capsuleYears, setCapsuleYears] = useState<number | null>(null);
  const [sealingCapsule, setSealingCapsule] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [trophyCount, setTrophyCount] = useState(0);
  const [cells, setCells] = useState<Cell[][]>(
    Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => ({ row_index: r, col_index: c, content: '', cell_type: 'task' }))
    )
  );
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [fullscreen, setFullscreen] = useState(false);
  const [halfSize, setHalfSize] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('grid-half') === 'true'
  );

  const fetchData = useCallback(async () => {
    const [gridRes, statsRes, tasksRes, achRes] = await Promise.all([fetch('/api/grid'), fetch('/api/stats'), fetch('/api/tasks'), fetch('/api/achievements')]);
    const gridData = await gridRes.json();
    const statsData = await statsRes.json();
    const tasksData = await tasksRes.json();

    // Upcoming = today's + every_day tasks not yet completed today, sorted by time_of_day
    const todayDow = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    const todayStr = new Date().toISOString().split('T')[0];
    const isDoneToday = (t: Task) => {
      if (t.every_day) return t.is_completed && t.completed_at?.split('T')[0] === todayStr;
      return t.is_completed;
    };
    const todayTasks: Task[] = (tasksData.tasks || []).filter((t: Task) =>
      !isDoneToday(t) && (t.every_day || t.day_of_week === todayDow)
    ).sort((a: Task, b: Task) => {
      if (a.time_of_day && b.time_of_day) return a.time_of_day.localeCompare(b.time_of_day);
      if (a.time_of_day) return -1;
      if (b.time_of_day) return 1;
      return 0;
    });
    setUpcomingTasks(todayTasks.slice(0, 5));

    const tomorrowDow = (todayDow + 1) % 7;
    const byTime = (a: Task, b: Task) => {
      if (a.time_of_day && b.time_of_day) return a.time_of_day.localeCompare(b.time_of_day);
      if (a.time_of_day) return -1;
      if (b.time_of_day) return 1;
      return 0;
    };
    const allTasks: Task[] = tasksData.tasks || [];
    const daySpecific = allTasks.filter((t: Task) => t.day_of_week === tomorrowDow && !t.every_day).sort(byTime);
    const everyDay = allTasks.filter((t: Task) => t.every_day).sort(byTime);
    const tomorrowList = [...daySpecific, ...everyDay].slice(0, 2);
    setTomorrowTasks(tomorrowList);

    const achData = await achRes.json();
    setTrophyCount((achData.achievements || []).filter((a: { is_locked: boolean }) => !a.is_locked).length);
    const newCells = Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => ({ row_index: r, col_index: c, content: '', cell_type: 'task' }))
    );
    gridData.cells?.forEach((cell: Cell) => {
      if (cell.row_index >= 0 && cell.row_index < 9 && cell.col_index >= 0 && cell.col_index < 9) {
        newCells[cell.row_index][cell.col_index] = cell;
      }
    });
    setCells(newCells);
    setStats(statsData.stats || {});
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch capsule separately so it doesn't block main data
  useEffect(() => {
    fetch('/api/dream-capsule').then(r => r.json()).then(d => setCapsule(d.capsule ?? null));
  }, []);

  // Countdown tick
  useEffect(() => {
    if (!capsule?.is_sealed || !capsule.locked_until) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [capsule?.is_sealed, capsule?.locked_until]);

  function openEdit(r: number, c: number) {
    setEditing({ r, c });
    setEditValue(cells[r][c].content);
  }

  async function saveCell() {
    if (!editing) return;
    const { r, c } = editing;
    const role = getCellRole(r, c);
    const cellType = role === 'ultimate' ? 'ultimate' : role === 'pillar' ? 'pillar' : 'task';
    await fetch('/api/grid', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row_index: r, col_index: c, content: editValue, cell_type: cellType }),
    });
    const newCells = cells.map(row => row.map(cell => ({ ...cell })));
    newCells[r][c] = { row_index: r, col_index: c, content: editValue, cell_type: cellType };
    setCells(newCells);
    setEditing(null);
  }

  const allSkills = ['energy', 'intelligence', 'strength', 'bravery', 'wealth', 'discipline', 'wisdom', 'influence'];
  const totalPoints = allSkills.reduce((sum, s) => sum + (stats[s] || 0), 0);
  const filledCells = cells.flat().filter(c => c.content.trim()).length;
  const integrityPct = Math.round((filledCells / 81) * 100);

  const editRole = editing ? getCellRole(editing.r, editing.c) : null;

  async function openCapsuleModal() {
    if (capsule && !capsule.is_sealed) {
      setCapsuleId(capsule.id); setCapsuleContent(capsule.content || ''); setCapsuleStep('write');
    } else if (capsule?.is_sealed && capsule.locked_until && new Date(capsule.locked_until) <= new Date()) {
      setCapsuleContent(capsule.content || ''); setCapsuleStep('read');
    } else {
      setCapsuleId(null); setCapsuleContent(''); setCapsuleStep('write');
    }
    setShowCapsule(true);
  }

  async function saveCapsuleDraft() {
    setSavingDraft(true);
    if (capsuleId) {
      await fetch('/api/dream-capsule', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: capsuleId, content: capsuleContent }) });
    } else {
      const res = await fetch('/api/dream-capsule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: capsuleContent }) });
      const d = await res.json(); setCapsuleId(d.capsule?.id ?? null);
      setCapsule(d.capsule);
    }
    setSavingDraft(false);
    setShowCapsule(false);
    const d = await fetch('/api/dream-capsule').then(r => r.json());
    setCapsule(d.capsule ?? null);
  }

  async function sealCapsule() {
    if (!capsuleYears) return;
    setSealingCapsule(true);
    let id = capsuleId;
    if (!id) {
      const res = await fetch('/api/dream-capsule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: capsuleContent }) });
      const d = await res.json(); id = d.capsule?.id;
    }
    if (id) {
      await fetch('/api/dream-capsule', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, content: capsuleContent, seal: true, years: capsuleYears }) });
    }
    setSealingCapsule(false);
    setShowCapsule(false);
    const d = await fetch('/api/dream-capsule').then(r => r.json());
    setCapsule(d.capsule ?? null);
  }

  const capsuleIsSealed = capsule?.is_sealed && capsule.locked_until && new Date(capsule.locked_until) > new Date();
  const capsuleIsUnlocked = capsule?.is_sealed && capsule.locked_until && new Date(capsule.locked_until) <= new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-4xl" style={{ color: '#afc6ff' }}>progress_activity</span>
          <p className="mt-4 text-xs font-bold tracking-widest uppercase" style={{ color: '#8c90a1' }}>Loading Mission Map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#afc6ff' }}>Core Operating System</p>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>Mission Map</h1>
        </div>
        <div className="flex gap-3">
          <div className="glass-card px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ color: '#afc6ff', fontSize: '16px' }}>bolt</span>
            <span className="text-xs font-bold" style={{ color: '#e4e1e9' }}>{totalPoints} XP</span>
          </div>
          <div className="glass-card px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ color: '#ffd700', fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>military_tech</span>
            <span className="text-xs font-bold" style={{ color: '#e4e1e9' }}>{trophyCount}</span>
          </div>
        </div>
      </div>

      {/* Mobile fullscreen button — above the grid card */}
      <div className="flex md:hidden justify-end mb-2">
        <button onClick={() => setFullscreen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8c90a1' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>fullscreen</span>
        </button>
      </div>

      {/* Grid outer card */}
      <div className="relative rounded-[2rem] overflow-hidden p-2 md:p-6"
        style={{ background: 'rgba(14,14,19,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'rgba(175,198,255,0.08)', filter: 'blur(80px)' }} />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'rgba(200,99,251,0.06)', filter: 'blur(80px)' }} />

        {/* Controls — top-right of the card (desktop only) */}
        <div className="absolute top-3 right-3 z-20 hidden md:flex items-center gap-1.5">
          <button onClick={() => setHalfSize(v => { localStorage.setItem('grid-half', String(!v)); return !v; })}
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: halfSize ? 'rgba(175,198,255,0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${halfSize ? 'rgba(175,198,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
              color: halfSize ? '#afc6ff' : '#8c90a1',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.12)'; (e.currentTarget as HTMLElement).style.color = '#afc6ff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = halfSize ? 'rgba(175,198,255,0.15)' : 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = halfSize ? '#afc6ff' : '#8c90a1'; }}>
            {halfSize ? '×2' : '×0.5'}
          </button>
          <button onClick={() => setFullscreen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8c90a1' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.12)'; (e.currentTarget as HTMLElement).style.color = '#afc6ff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#8c90a1'; }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>fullscreen</span>
          </button>
        </div>

        <div className="relative mx-auto z-10 transition-all duration-300"
          style={halfSize
            ? { width: 'min(calc(100vh - 260px), 100%)', aspectRatio: '1 / 1' }
            : { maxWidth: 900, aspectRatio: '1 / 1' }}>
          <GridView cells={cells} onEdit={openEdit} half={halfSize} />
        </div>
      </div>

      {/* Stats bento */}
      <div className="flex flex-col md:flex-row gap-4 mt-6 md:items-stretch">
        {/* Today's Tasks — fixed height on desktop only */}
        <div className="md:w-1/2 glass-card p-6 rounded-3xl flex flex-col md:min-h-[340px]">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: '#8c90a1' }}>Today's Tasks</h3>
            <Link href="/tasks" className="text-xs font-bold transition-colors" style={{ color: '#afc6ff' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
              View all →
            </Link>
          </div>
          {upcomingTasks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
              <span className="material-symbols-outlined mb-2" style={{ color: '#414655', fontSize: '32px' }}>task_alt</span>
              <p className="text-sm" style={{ color: '#8c90a1' }}>All done for today</p>
              <TomorrowSection tasks={tomorrowTasks} />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {upcomingTasks.map(task => {
                const color = SKILL_COLORS[task.skill] || '#afc6ff';
                return (
                  <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${color}` }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#e4e1e9' }}>{task.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>
                        <span style={{ color }}>{task.skill}</span>
                        {' · '}{task.duration_minutes}m
                        {task.time_of_day && <span> · {task.time_of_day}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
              {upcomingTasks.length <= 2 && <TomorrowSection tasks={tomorrowTasks} />}
            </div>
          )}
        </div>

        {/* Right column: Skill XP + Dream Capsule */}
        <div className="md:w-1/2 flex flex-col gap-4">
          <div className="glass-card p-6 rounded-3xl flex-shrink-0">
            <h3 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#8c90a1' }}>Skill XP</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {allSkills.map(skill => {
                const pts = stats[skill] || 0;
                return (
                  <div key={skill}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ color: '#afc6ff', fontSize: '10px' }}>{SKILL_ICONS[skill]}</span>
                        <span className="text-xs capitalize" style={{ color: '#c1c6d8' }}>{skill}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: '#afc6ff' }}>{pts}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(pts / 6000) * 100}%`, background: '#afc6ff', transition: 'width 0.7s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dream Capsule */}
          <div className="glass-card p-6 rounded-3xl flex-1 flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(175,198,255,0.05) 0%, transparent 70%)' }} />
            <h3 className="text-xs font-bold tracking-widest uppercase mb-1 relative" style={{ color: '#8c90a1' }}>Dream Capsule</h3>

            {capsuleIsSealed ? (
              /* SEALED — show countdown */
              <div className="flex-1 flex flex-col items-center justify-center text-center relative gap-2">
                <span className="material-symbols-outlined mb-1" style={{ color: '#afc6ff', fontSize: '28px', fontVariationSettings: "'FILL' 1" }}>lock</span>
                <p className="text-2xl font-black tracking-tight" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>
                  {formatCountdown(capsule!.locked_until!, nowTick)}
                </p>
                <p className="text-xs leading-relaxed max-w-[200px]" style={{ color: '#414655' }}>
                  Make every moment count. Your future self is watching.
                </p>
                <p className="text-xs mt-1" style={{ color: '#414655' }}>
                  Opens {new Date(capsule!.locked_until!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            ) : capsuleIsUnlocked ? (
              /* UNLOCKED — ready to open */
              <div className="flex-1 flex flex-col items-center justify-center text-center relative gap-3">
                <span className="material-symbols-outlined" style={{ color: '#ffd700', fontSize: '28px', fontVariationSettings: "'FILL' 1" }}>lock_open</span>
                <p className="text-sm font-bold" style={{ color: '#e4e1e9' }}>Your capsule is ready</p>
                <p className="text-xs" style={{ color: '#8c90a1' }}>Sealed on {new Date(capsule!.sealed_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <button onClick={openCapsuleModal}
                  className="px-5 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)', color: '#ffd700' }}>
                  Open Capsule ✨
                </button>
              </div>
            ) : capsule && !capsule.is_sealed ? (
              /* DRAFT */
              <div className="flex-1 flex flex-col items-center justify-center text-center relative gap-3">
                <span className="material-symbols-outlined" style={{ color: '#8c90a1', fontSize: '24px' }}>edit_note</span>
                <p className="text-xs" style={{ color: '#8c90a1' }}>Draft saved</p>
                <button onClick={openCapsuleModal}
                  className="px-5 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{ background: 'rgba(175,198,255,0.1)', border: '1px solid rgba(175,198,255,0.25)', color: '#afc6ff' }}>
                  Continue Writing
                </button>
              </div>
            ) : (
              /* EMPTY */
              <div className="flex-1 flex flex-col items-center justify-center text-center relative gap-3">
                <span className="material-symbols-outlined mb-1" style={{ color: '#414655', fontSize: '28px' }}>rocket_launch</span>
                <p className="text-xs leading-relaxed max-w-[220px]" style={{ color: '#414655' }}>
                  Write a letter to your future self. Seal it for 1, 2, 3, 5, or 10 years — then let time do the rest.
                </p>
                <button onClick={openCapsuleModal}
                  className="px-5 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{ background: 'rgba(175,198,255,0.08)', border: '1px solid rgba(175,198,255,0.2)', color: '#afc6ff' }}>
                  Begin Dream Capsule
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen overlay — click outside grid closes it */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
          style={{ background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(12px)', cursor: 'pointer' }}
          onClick={() => setFullscreen(false)}>
          <button onClick={e => { e.stopPropagation(); setFullscreen(false); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#e4e1e9' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>fullscreen_exit</span>
          </button>
          <div className="w-full h-full flex items-center justify-center p-3 md:p-6">
            <div style={{ width: 'min(88vmin, 88vw)', height: 'min(88vmin, 88vh)', flexShrink: 0, cursor: 'default' }}
              onClick={e => e.stopPropagation()}>
              <GridView cells={cells} onEdit={openEdit} fullscreen />
            </div>
          </div>
        </div>
      )}

      {/* ---- Dream Capsule Modal ---- */}
      {showCapsule && (
        <div className="fixed inset-0 z-[60] flex flex-col animate-fade-in"
          style={{ background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(12px)' }}>

          {capsuleStep === 'read' ? (
            /* READ VIEW — unlocked capsule */
            <>
              <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div>
                  <h2 className="text-xl font-black" style={{ fontFamily: 'var(--font-jakarta)', color: '#ffd700' }}>Your Dream Capsule</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>
                    Sealed on {capsule?.sealed_at ? new Date(capsule.sealed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                  </p>
                </div>
                <button onClick={() => setShowCapsule(false)} className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#8c90a1' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-16 py-8 max-w-3xl w-full mx-auto">
                {capsuleContent ? (
                  <div className="rich-editor-content" dangerouslySetInnerHTML={{ __html: capsuleContent }} />
                ) : (
                  <p style={{ color: '#414655', fontStyle: 'italic' }}>The capsule is empty.</p>
                )}
              </div>
              <div className="flex-shrink-0 px-6 py-4 border-t flex justify-end" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <button onClick={() => { setShowCapsule(false); setCapsule(null); setCapsuleId(null); setCapsuleContent(''); setCapsuleStep('write'); }}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(175,198,255,0.1)', border: '1px solid rgba(175,198,255,0.25)', color: '#afc6ff' }}>
                  Write New Capsule
                </button>
              </div>
            </>
          ) : capsuleStep === 'write' ? (
            /* WRITE STEP */
            <>
              <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div>
                  <h2 className="text-xl font-black" style={{ fontFamily: 'var(--font-jakarta)', color: '#afc6ff' }}>Dream Capsule</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>A letter to your future self — sealed in time</p>
                </div>
                <button onClick={saveCapsuleDraft} disabled={savingDraft}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8c90a1' }}>
                  {savingDraft ? 'Saving...' : 'Save Draft'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 md:px-16 py-6 max-w-3xl w-full mx-auto">
                <div className="glass-panel rounded-2xl border-l-4 overflow-hidden relative" style={{ borderLeftColor: '#afc6ff' }}>
                  <CapsuleEditor content={capsuleContent} onChange={setCapsuleContent} />
                </div>
              </div>
              <div className="flex-shrink-0 px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,15,0.8)' }}>
                <button onClick={() => setShowCapsule(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Cancel</button>
                <button onClick={() => { setCapsuleYears(null); setCapsuleStep('timeframe'); }}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 15px rgba(175,198,255,0.3)' }}>
                  Continue →
                </button>
              </div>
            </>
          ) : capsuleStep === 'timeframe' ? (
            /* TIMEFRAME STEP */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <span className="material-symbols-outlined mb-4" style={{ color: '#afc6ff', fontSize: '40px' }}>schedule</span>
              <h2 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>When should this open?</h2>
              <p className="text-sm mb-8 max-w-sm" style={{ color: '#8c90a1' }}>
                Once sealed, you won&apos;t be able to read or edit it until this time passes.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {[1, 2, 3, 5, 10].map(y => (
                  <button key={y} onClick={() => setCapsuleYears(y)}
                    className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-black transition-all"
                    style={capsuleYears === y
                      ? { background: 'rgba(175,198,255,0.18)', border: '2px solid #afc6ff', color: '#afc6ff', boxShadow: '0 0 20px rgba(175,198,255,0.2)' }
                      : { background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.1)', color: '#8c90a1' }}>
                    <span className="text-2xl">{y}</span>
                    <span className="text-xs font-bold tracking-wider">{y === 1 ? 'YEAR' : 'YEARS'}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setCapsuleStep('write')}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>← Back</button>
                <button disabled={!capsuleYears} onClick={() => setCapsuleStep('confirm')}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all"
                  style={{ background: capsuleYears ? '#afc6ff' : 'rgba(175,198,255,0.3)', color: '#002d6d', cursor: capsuleYears ? 'pointer' : 'not-allowed' }}>
                  Seal Capsule 🔒
                </button>
              </div>
            </div>
          ) : (
            /* CONFIRM STEP */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <span className="material-symbols-outlined mb-4" style={{ color: '#ffb4ab', fontSize: '40px' }}>warning</span>
              <h2 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>Are you sure?</h2>
              {capsuleYears && (
                <>
                  <p className="text-base mb-2" style={{ color: '#c1c6d8' }}>
                    Your capsule will be sealed until{' '}
                    <span style={{ color: '#afc6ff', fontWeight: 700 }}>
                      {(() => { const d = new Date(); d.setFullYear(d.getFullYear() + capsuleYears); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); })()}
                    </span>
                  </p>
                  <p className="text-sm mb-8 max-w-sm" style={{ color: '#8c90a1' }}>
                    You won&apos;t be able to read or edit it until then. Your future self will thank you.
                  </p>
                </>
              )}
              <div className="flex gap-3">
                <button onClick={() => setCapsuleStep('timeframe')}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>← Back</button>
                <button onClick={sealCapsule} disabled={sealingCapsule}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(175,198,255,0.15)', border: '1px solid rgba(175,198,255,0.4)', color: '#afc6ff', boxShadow: '0 0 15px rgba(175,198,255,0.15)' }}>
                  {sealingCapsule ? 'Sealing...' : 'Yes, Seal it 🔒'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal — z-60 so it sits above the fullscreen overlay */}
      {editing && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setEditing(null)}>
          <div className="w-full max-w-sm rounded-t-3xl md:rounded-2xl p-6 animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>
                  {editRole === 'ultimate' ? 'Main Goal' : editRole === 'pillar' ? 'Pillar Skill' : 'Daily Task'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>
                  {editRole === 'ultimate' ? 'Your big dream — the ultimate mission' :
                   editRole === 'pillar' ? 'A key skill, quality or attribute required' :
                   'A habit, task or practice to build this pillar'}
                </p>
              </div>
              <button onClick={() => setEditing(null)} style={{ color: '#8c90a1' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <textarea value={editValue} onChange={e => setEditValue(e.target.value)}
              autoFocus rows={3} maxLength={60}
              placeholder="Enter text..."
              className="w-full rounded-xl p-3 text-sm resize-none outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(175,198,255,0.3)', color: '#e4e1e9', boxShadow: '0 0 0 3px rgba(175,198,255,0.08)' }}
            />
            <div className="flex justify-end mb-4">
              <span className="text-xs" style={{ color: '#414655' }}>{editValue.length}/60</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Cancel</button>
              <button onClick={saveCell} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 15px rgba(175,198,255,0.3)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
