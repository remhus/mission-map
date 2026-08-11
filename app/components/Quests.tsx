'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { RANK_CONFIG, SKILLS, type Rank } from '@/lib/weeklyQuest';

const SKILL_ICONS: Record<string, string> = {
  energy: 'bolt', intelligence: 'psychology', strength: 'fitness_center',
  bravery: 'shield', wealth: 'payments', discipline: 'military_tech',
  wisdom: 'auto_stories', influence: 'public',
};
const SKILL_COLORS: Record<string, string> = {
  energy: '#ffd700', intelligence: '#afc6ff', strength: '#ff6b6b', bravery: '#c3f400',
  wealth: '#4ecdc4', discipline: '#e9b3ff', wisdom: '#f97316', influence: '#fd79a8',
};
const RANK_COLORS: Record<Rank, string> = { C: '#7CFF00', B: '#00A8FF', A: '#FF2BD6', S: '#FFB000' };

type Quest = {
  id: number;
  version: number;
  status: string;
  title: string;
  objective: string;
  victoryCondition: string;
  rank: Rank;
  targetPillar: string;
  targetSubCell: string;
  skillXp: Record<string, number>;
  totalXp: number;
  estHours: number;
  isFallback: boolean;
  completedAt: string | null;
};

type State = {
  enabled: boolean;
  timezone: string;
  weekStart: string;
  weekLabel: string;
  gridReady: 'empty' | 'goal-only' | 'ready';
  boardVersion: number;
  generating: boolean;
  rerollAvailable: boolean;
  offers: Quest[] | null;
  quest: Quest | null;
};

function RankBadge({ rank, size = 44 }: { rank: Rank; size?: number }) {
  const c = RANK_COLORS[rank];
  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <div className="rounded-xl flex items-center justify-center font-black"
        style={{ width: size, height: size, fontSize: size * 0.46, background: `${c}1f`, border: `1px solid ${c}66`, color: c, fontFamily: 'var(--font-jakarta)' }}>
        {rank}
      </div>
      <span className="text-[9px] font-bold tracking-widest uppercase text-muted">Rank</span>
    </div>
  );
}

function Rewards({ skillXp, glow }: { skillXp: Record<string, number>; glow?: boolean }) {
  const active = SKILLS.filter(s => (skillXp[s] || 0) > 0);
  if (!active.length) return <span className="text-xs text-faint">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map(s => (
        <span key={s} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold"
          style={{ background: `${SKILL_COLORS[s]}14`, border: `1px solid ${SKILL_COLORS[s]}33`, color: SKILL_COLORS[s], boxShadow: glow ? `0 0 10px ${SKILL_COLORS[s]}30` : 'none' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{SKILL_ICONS[s]}</span>
          <span className="capitalize">{s}</span>
          <span className="text-ink">+{skillXp[s]}</span>
        </span>
      ))}
    </div>
  );
}

const adminLink = (
  <Link href="/quest-admin" className="btn-ghost flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold">
    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit_note</span>
    Quest Admin
  </Link>
);

export default function Quests() {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [detailRank, setDetailRank] = useState<Rank | null>(null);
  const [confirmAccept, setConfirmAccept] = useState(false);

  const fetchState = useCallback(async () => {
    const res = await fetch('/api/weekly-quest');
    if (res.ok) setState(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchState(); }, [fetchState]);

  async function enableFeature() {
    setEnabling(true);
    await fetch('/api/settings/weekly-quest', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, timezone: state?.timezone || 'Europe/London' }),
    });
    await fetchState();
    setEnabling(false);
  }

  async function acceptQuest(rank: Rank) {
    setConfirmAccept(false); setDetailRank(null);
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/weekly-quest/select', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rank }),
      });
      if (!res.ok) { setError('failed'); return; }
      const d = await res.json();
      if (d.quest) setState(s => s ? { ...s, quest: d.quest, offers: null } : s);
    } catch { setError('failed'); }
    finally { setBusy(false); }
  }

  async function completeQuest() {
    if (!state?.quest) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/weekly-quest/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: state.quest.id }),
      });
      if (res.ok) setState(s => s && s.quest ? { ...s, quest: { ...s.quest, status: 'completed' } } : s);
      else setError('failed');
    } catch { setError('failed'); }
    finally { setBusy(false); }
  }

  function Shell({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-1 text-accent">Weekly Challenge</p>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>Boss Quests</h1>
            {state && <p className="text-sm mt-1 text-muted">Week of {state.weekLabel}</p>}
          </div>
          {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
        </div>
        {children}
      </div>
    );
  }

  const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };

  if (loading) return <Shell><div className="rounded-2xl skeleton" style={{ minHeight: 240 }} /></Shell>;
  if (!state) return <Shell><p className="text-muted">Could not load quests.</p></Shell>;

  // Not enabled → intro.
  if (!state.enabled) {
    return (
      <Shell>
        <div className="rounded-2xl p-7 md:p-9 animate-slide-up" style={cardStyle}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(175,198,255,0.1)', border: '1px solid rgba(175,198,255,0.2)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#afc6ff' }}>swords</span>
          </div>
          <h2 className="text-xl font-black mb-2 text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>Weekly Boss Quests</h2>
          <p className="text-sm leading-relaxed text-ink-2 mb-5 max-w-xl">
            A board of four boss quests — one per rank — built from your Mandala grid. Generate them with any LLM in
            <strong> Quest Admin</strong> (copy the prompt, paste the JSON back), then pick your challenge and complete it to earn skill XP.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={enableFeature} disabled={enabling} className="btn-primary flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
              {enabling ? 'Enabling…' : 'Enable Quests'}
            </button>
            <Link href="/quest-admin" className="btn-ghost flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit_note</span>
              Open Quest Admin
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  // Grid too empty.
  if (state.gridReady === 'empty') {
    return (
      <Shell>
        <div className="rounded-2xl p-8 text-center animate-slide-up" style={cardStyle}>
          <span className="material-symbols-outlined mb-4" style={{ color: '#414655', fontSize: '52px' }}>grid_view</span>
          <h2 className="text-lg font-black mb-2 text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>Fill in your Mission Map first</h2>
          <p className="text-sm text-muted mb-6 max-w-sm mx-auto">Set your ultimate goal in the centre of the grid and at least one pillar around it. Quests are built from your mission.</p>
          <Link href="/dashboard" className="btn-soft-accent inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
            Open the Grid
          </Link>
        </div>
      </Shell>
    );
  }

  const quest = state.quest;

  // Board (choose one).
  if (!quest && state.offers) {
    const detail = detailRank ? state.offers.find(o => o.rank === detailRank) : null;
    return (
      <Shell action={adminLink}>
        <div className="grid gap-4 sm:grid-cols-2 stagger-children">
          {state.offers.map(o => {
            const cfg = RANK_CONFIG[o.rank];
            return (
              <button key={o.rank} onClick={() => setDetailRank(o.rank)} className="glass-card rounded-2xl p-5 flex flex-col gap-3 text-left">
                <div className="flex items-center gap-3">
                  <RankBadge rank={o.rank} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-black text-white leading-tight" style={{ fontFamily: 'var(--font-jakarta)' }}>{o.title}</h3>
                    <p className="text-[11px] text-muted mt-0.5">{cfg.friction}</p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-ink-2" style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.objective}</p>
                <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                  <span className="text-sm font-black text-accent">{o.totalXp} XP</span>
                  <span className="text-xs text-muted flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>schedule</span>~{o.estHours}h</span>
                </div>
                <div className="btn-soft-accent flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold">
                  View &amp; Accept <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>chevron_right</span>
                </div>
              </button>
            );
          })}
        </div>
        {error === 'failed' && <p className="text-sm text-danger mt-4">Something went wrong. Try again.</p>}

        {detail && (
          <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4 animate-fade-in"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} onClick={() => { setDetailRank(null); setConfirmAccept(false); }}>
            <div className="w-full max-w-md rounded-t-3xl md:rounded-3xl animate-slide-up" style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <QuestBody quest={detail} />
              <div className="px-6 pb-6 flex flex-col gap-2">
                {confirmAccept ? (
                  <>
                    <p className="text-xs text-center mb-1 text-danger">Accepting locks your week — the other quests are cleared.</p>
                    <button onClick={() => acceptQuest(detail.rank)} disabled={busy} className="btn-primary w-full py-3 rounded-xl font-bold text-sm">
                      {busy ? 'Accepting…' : `Accept the ${detail.rank}-Rank Quest`}
                    </button>
                    <button onClick={() => setConfirmAccept(false)} className="btn-quiet w-full py-2.5 rounded-xl text-sm font-semibold">Not yet</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setConfirmAccept(true)} className="btn-primary w-full py-3 rounded-xl font-bold text-sm">Accept This Quest</button>
                    <button onClick={() => setDetailRank(null)} className="btn-quiet w-full py-2.5 rounded-xl text-sm font-semibold">Back to quests</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Shell>
    );
  }

  // Enabled but no board yet → send to admin.
  if (!quest) {
    return (
      <Shell action={adminLink}>
        <div className="rounded-2xl p-8 text-center animate-slide-up" style={cardStyle}>
          <span className="material-symbols-outlined mb-4" style={{ color: '#414655', fontSize: '48px' }}>playlist_add</span>
          <h2 className="text-lg font-black mb-2 text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>No quests yet this week</h2>
          <p className="text-sm text-muted mb-6 max-w-sm mx-auto">Generate a board in Quest Admin: copy the prompt into any LLM, then paste the JSON response back.</p>
          <Link href="/quest-admin" className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit_note</span>Open Quest Admin
          </Link>
        </div>
      </Shell>
    );
  }

  // Active / completed quest.
  const isCompleted = quest.status === 'completed';
  const rankColor = RANK_COLORS[quest.rank];
  return (
    <Shell action={!isCompleted ? adminLink : undefined}>
      <div className="rounded-2xl overflow-hidden animate-slide-up" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${isCompleted ? 'rgba(195,244,0,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
        <QuestBody quest={quest} completed={isCompleted} accentBar={rankColor} />
        <div className="px-6 pb-6">
          {!isCompleted ? (
            <button onClick={completeQuest} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
              {busy ? 'Saving…' : 'Complete Quest'}
            </button>
          ) : (
            <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(195,244,0,0.06)', border: '1px solid rgba(195,244,0,0.22)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#c3f400' }}>military_tech</span>
              <div>
                <p className="text-sm font-bold text-ink">Quest complete — {quest.totalXp} XP earned.</p>
                <p className="text-xs text-muted">Import a new board in Quest Admin any time.</p>
              </div>
            </div>
          )}
          {error === 'failed' && <p className="text-sm text-danger mt-3">Something went wrong. Try again.</p>}
        </div>
      </div>
    </Shell>
  );
}

function QuestBody({ quest, completed, accentBar }: { quest: Quest; completed?: boolean; accentBar?: string }) {
  const cfg = RANK_CONFIG[quest.rank];
  return (
    <>
      {accentBar && <div style={{ height: 3, background: `linear-gradient(90deg, ${accentBar}, transparent)` }} />}
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-start gap-4 mb-4">
          <RankBadge rank={quest.rank} size={52} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-white leading-tight" style={{ fontFamily: 'var(--font-jakarta)' }}>{quest.title}</h2>
            <p className="text-xs text-muted mt-1">{cfg.friction}</p>
            {(quest.targetPillar || quest.targetSubCell) && (
              <p className="text-xs text-faint mt-0.5 truncate">{quest.targetPillar}{quest.targetSubCell ? ` › ${quest.targetSubCell}` : ''}</p>
            )}
          </div>
          {completed && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0" style={{ background: 'rgba(195,244,0,0.12)', border: '1px solid rgba(195,244,0,0.3)', color: '#c3f400' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>Done
            </span>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-muted mb-1.5">Objective</p>
            <p className="text-sm leading-relaxed text-ink-2">{quest.objective}</p>
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-muted mb-1.5">Victory Condition</p>
            <p className="text-sm leading-relaxed text-ink-2">{quest.victoryCondition}</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-bold tracking-widest uppercase text-muted">Reward · {quest.totalXp} XP</p>
              <span className="text-xs text-muted flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>schedule</span>~{quest.estHours}h</span>
            </div>
            <Rewards skillXp={quest.skillXp} glow={completed} />
          </div>
        </div>
      </div>
    </>
  );
}
