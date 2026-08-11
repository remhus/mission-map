'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { RANK_CONFIG, SKILLS, type Rank } from '@/lib/weeklyQuest';

// ── Skill presentation (mirrors dashboard) ──────────────────────────────────
const SKILL_ICONS: Record<string, string> = {
  energy: 'bolt', intelligence: 'psychology', strength: 'fitness_center',
  bravery: 'shield', wealth: 'payments', discipline: 'military_tech',
  wisdom: 'auto_stories', influence: 'public',
};
const SKILL_COLORS: Record<string, string> = {
  energy: '#ffd700', intelligence: '#afc6ff', strength: '#ff6b6b', bravery: '#c3f400',
  wealth: '#4ecdc4', discipline: '#e9b3ff', wisdom: '#f97316', influence: '#fd79a8',
};

const SYS = '#8cc6ff'; // System blue
const RANK_COLORS: Record<Rank, string> = { C: '#8c90a1', B: '#4ecdc4', A: '#8cc6ff', S: '#ffd700' };

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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function Corners({ color = SYS }: { color?: string }) {
  const b: React.CSSProperties = { position: 'absolute', width: 12, height: 12, pointerEvents: 'none' };
  return (
    <>
      <span style={{ ...b, top: -1, left: -1, borderTop: `2px solid ${color}`, borderLeft: `2px solid ${color}` }} />
      <span style={{ ...b, top: -1, right: -1, borderTop: `2px solid ${color}`, borderRight: `2px solid ${color}` }} />
      <span style={{ ...b, bottom: -1, left: -1, borderBottom: `2px solid ${color}`, borderLeft: `2px solid ${color}` }} />
      <span style={{ ...b, bottom: -1, right: -1, borderBottom: `2px solid ${color}`, borderRight: `2px solid ${color}` }} />
    </>
  );
}

function Sigil({ rank, size = 44 }: { rank: Rank; size?: number }) {
  const color = RANK_COLORS[rank];
  return (
    <div className="rounded-lg flex items-center justify-center font-black flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45, background: `${color}22`, border: `1px solid ${color}66`, color, fontFamily: 'var(--font-jakarta)', textShadow: `0 0 12px ${color}` }}>
      {rank}
    </div>
  );
}

function Rewards({ skillXp, total, glow }: { skillXp: Record<string, number>; total: number; glow?: boolean }) {
  const active = SKILLS.filter(s => (skillXp[s] || 0) > 0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map(s => (
        <span key={s} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: `${SKILL_COLORS[s]}14`, border: `1px solid ${SKILL_COLORS[s]}40`, color: SKILL_COLORS[s], boxShadow: glow ? `0 0 10px ${SKILL_COLORS[s]}30` : 'none' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{SKILL_ICONS[s]}</span>
          <span className="capitalize">{s}</span>
          <span style={{ color: '#e4e1e9' }}>+{skillXp[s]}</span>
        </span>
      ))}
      {active.length === 0 && <span className="text-xs text-faint">—</span>}
    </div>
  );
}

export default function Quests() {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [detailRank, setDetailRank] = useState<Rank | null>(null); // open offer detail
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const autoTriggered = useRef(false);

  const fetchState = useCallback(async () => {
    const res = await fetch('/api/weekly-quest');
    if (res.ok) setState(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchState(); }, [fetchState]);

  async function pollBoard() {
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const res = await fetch('/api/weekly-quest');
      if (!res.ok) continue;
      const d: State = await res.json();
      if (d.offers || d.quest || !d.generating) { setState(d); return; }
    }
    await fetchState();
  }

  const generateBoard = useCallback(async () => {
    setBusy(true); setGenerating(true); setError(null);
    try {
      const res = await fetch('/api/weekly-quest/board', { method: 'POST' });
      if (res.status === 422) { setError('grid'); await fetchState(); return; }
      if (res.status === 202) { await pollBoard(); return; }
      if (!res.ok) { setError('failed'); return; }
      const d = await res.json();
      if (d.offers) setState(s => s ? { ...s, offers: d.offers, generating: false, rerollAvailable: true } : s);
      else if (d.quest) setState(s => s ? { ...s, quest: d.quest, offers: null } : s);
      else await pollBoard();
    } catch { setError('failed'); }
    finally { setBusy(false); setGenerating(false); }
  }, [fetchState]);

  // Auto-forge the board on first visit when eligible and none exists yet.
  useEffect(() => {
    if (autoTriggered.current || !state) return;
    if (state.enabled && state.gridReady !== 'empty' && !state.offers && !state.quest && !state.generating) {
      autoTriggered.current = true;
      generateBoard();
    }
  }, [state, generateBoard]);

  async function enableFeature() {
    setEnabling(true);
    await fetch('/api/settings/weekly-quest', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, timezone: state?.timezone || 'Europe/London' }),
    });
    await fetchState();
    setEnabling(false);
  }

  async function reforge() {
    setBusy(true); setGenerating(true); setError(null);
    try {
      const res = await fetch('/api/weekly-quest/reroll', { method: 'POST' });
      if (res.status === 202) { await pollBoard(); return; }
      if (!res.ok) { setError('failed'); return; }
      const d = await res.json();
      if (d.offers) setState(s => s ? { ...s, offers: d.offers, rerollAvailable: true } : s);
      else await pollBoard();
    } catch { setError('failed'); }
    finally { setBusy(false); setGenerating(false); }
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
      if (d.quest) setState(s => s ? { ...s, quest: d.quest, offers: null, rerollAvailable: false } : s);
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
      if (res.ok) {
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1200);
        setState(s => s && s.quest ? { ...s, quest: { ...s.quest, status: 'completed' } } : s);
      } else setError('failed');
    } catch { setError('failed'); }
    finally { setBusy(false); }
  }

  function Shell({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto">
        <div className="mb-7">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm sys-glow" style={{ color: SYS }}>◈</span>
            <p className="sys-mono text-[11px] font-bold uppercase" style={{ color: SYS }}>The System</p>
            {state && <span className="sys-mono text-[10px] uppercase ml-auto" style={{ color: 'rgba(140,198,255,0.5)' }}>{state.weekLabel}</span>}
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white sys-glow" style={{ fontFamily: 'var(--font-jakarta)' }}>{title}</h1>
        </div>
        {children}
      </div>
    );
  }

  if (loading) {
    return <Shell title="Boss Board"><div className="sys-panel rounded-xl p-8" style={{ minHeight: 260, opacity: 0.6 }}><div className="sys-scanbar" /></div></Shell>;
  }
  if (!state) return <Shell title="Boss Board"><p className="text-muted">The System is unreachable.</p></Shell>;

  // ── Not linked → awakening ──
  if (!state.enabled) {
    return (
      <Shell title="Boss Board">
        <div className="sys-panel rounded-xl p-7 md:p-9 sys-appear text-center">
          <Corners />
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center sys-pulse" style={{ background: 'radial-gradient(circle, rgba(140,198,255,0.25), transparent 70%)' }}>
              <span className="text-3xl sys-glow" style={{ color: SYS }}>◈</span>
            </div>
          </div>
          <p className="sys-mono text-[11px] font-bold uppercase mb-3" style={{ color: SYS }}>[ Notification ]</p>
          <h2 className="text-2xl font-black mb-3 text-white sys-glow" style={{ fontFamily: 'var(--font-jakarta)' }}>You have been chosen.</h2>
          <p className="text-sm leading-relaxed text-ink-2 max-w-md mx-auto mb-6">
            Each week the System posts a board of Boss Fights forged from your Mission — one at every rank. Pick your battle,
            or reforge the board. Clear it and its power is yours. These are not chores; they are milestones.
          </p>
          <button onClick={enableFeature} disabled={enabling}
            className="relative inline-flex items-center justify-center gap-2 px-7 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all"
            style={{ background: 'rgba(140,198,255,0.12)', border: `1px solid ${SYS}`, color: SYS, boxShadow: '0 0 22px rgba(140,198,255,0.25)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>hub</span>
            {enabling ? 'Linking…' : 'Link to the System'}
          </button>
          <p className="text-[11px] leading-relaxed mt-5 max-w-md mx-auto" style={{ color: 'rgba(140,144,161,0.7)' }}>
            To forge each board the System consults an external oracle (Google Gemini); the text it reads leaves your device. Sever anytime in Settings.
          </p>
        </div>
      </Shell>
    );
  }

  // ── Grid too empty ──
  if (state.gridReady === 'empty' || error === 'grid') {
    return (
      <Shell title="Boss Board">
        <div className="sys-panel rounded-xl p-8 text-center sys-appear">
          <Corners color="#8c90a1" />
          <span className="material-symbols-outlined mb-3 sys-pulse" style={{ color: SYS, fontSize: '44px' }}>grid_view</span>
          <p className="sys-mono text-[11px] font-bold uppercase mb-2" style={{ color: 'rgba(140,198,255,0.7)' }}>[ Signal Lost ]</p>
          <h2 className="text-lg font-black mb-2 text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>The System cannot read your Mission</h2>
          <p className="text-sm text-muted mb-6 max-w-sm mx-auto">Inscribe your ultimate goal at the centre of the grid and at least one pillar around it. Only then can bosses be forged.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider" style={{ background: 'rgba(140,198,255,0.1)', border: `1px solid ${SYS}55`, color: SYS }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
            Inscribe Your Mission
          </Link>
        </div>
      </Shell>
    );
  }

  const quest = state.quest;

  // ── Forging the board ──
  if (!quest && (generating || state.generating || (busy && !state.offers))) {
    return (
      <Shell title="Boss Board">
        <div className="sys-panel rounded-xl p-8 flex flex-col items-center text-center overflow-hidden" role="status" aria-live="polite" style={{ minHeight: 260 }}>
          <div className="sys-scanbar" />
          <Corners />
          <span className="text-3xl mb-5 sys-pulse sys-glow" style={{ color: SYS }}>◈</span>
          <h2 className="text-lg font-black mb-4 text-white sys-glow" style={{ fontFamily: 'var(--font-jakarta)' }}>Forging your bosses…</h2>
          <div className="sys-mono text-[11px] leading-6 text-left" style={{ color: 'rgba(140,198,255,0.65)' }}>
            <p>&gt; reading mandala grid</p>
            <p>&gt; scouting weak pillars</p>
            <p className="sys-pulse" style={{ color: SYS }}>&gt; summoning four bosses_</p>
          </div>
        </div>
      </Shell>
    );
  }

  // ── Quest Board (choose one) ──
  if (!quest && state.offers) {
    const detail = detailRank ? state.offers.find(o => o.rank === detailRank) : null;
    return (
      <Shell title="Boss Board">
        <div className="sys-appear">
          <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
            <p className="sys-mono text-[11px] font-bold uppercase" style={{ color: SYS }}>[ Choose Your Boss ]</p>
            {state.rerollAvailable && (
              <button onClick={reforge} disabled={busy}
                className="btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>autorenew</span>
                Reforge Board
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {state.offers.map((o, i) => {
              const color = RANK_COLORS[o.rank];
              const cfg = RANK_CONFIG[o.rank];
              return (
                <button key={o.rank} onClick={() => setDetailRank(o.rank)}
                  className={`relative text-left rounded-xl p-4 flex flex-col gap-3 transition-all sys-appear ${o.rank === 'S' ? 'sys-panel sys-panel-gold' : 'sys-panel'}`}
                  style={{ animationDelay: `${i * 70}ms` }}>
                  <div className="flex items-center gap-3">
                    <Sigil rank={o.rank} />
                    <div className="min-w-0 flex-1">
                      <p className="sys-mono text-[10px] uppercase" style={{ color: `${color}cc` }}>Rank {o.rank} · {cfg.friction.split('—')[1]?.trim() || ''}</p>
                      <h3 className="text-base font-black text-white leading-tight" style={{ fontFamily: 'var(--font-jakarta)' }}>{o.title}</h3>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-ink-2" style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.objective}</p>
                  <div className="flex items-center justify-between gap-2 mt-auto">
                    <span className="sys-mono text-[11px] font-bold" style={{ color }}>{o.totalXp} XP</span>
                    <span className="sys-mono text-[10px] uppercase flex items-center gap-1" style={{ color: 'rgba(193,198,216,0.5)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>schedule</span>~{o.estHours}h
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider" style={{ background: `${color}18`, border: `1px solid ${color}55`, color }}>
                    View & Accept <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>chevron_right</span>
                  </div>
                </button>
              );
            })}
          </div>
          {error === 'failed' && <p className="text-sm text-danger sys-mono uppercase text-[12px] mt-4">[ System error — try again ]</p>}
        </div>

        {/* Offer detail / accept */}
        {detail && (
          <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4 animate-fade-in"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} onClick={() => { setDetailRank(null); setConfirmAccept(false); }}>
            <div className={`w-full max-w-md rounded-xl sys-appear ${detail.rank === 'S' ? 'sys-panel sys-panel-gold' : 'sys-panel'}`}
              style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <Corners color={RANK_COLORS[detail.rank]} />
              <QuestBody quest={detail} />
              <div className="px-6 pb-6 flex flex-col gap-2">
                {confirmAccept ? (
                  <>
                    <p className="sys-mono text-[11px] uppercase text-center mb-1" style={{ color: 'rgba(255,180,171,0.9)' }}>This locks your week — the board is spent.</p>
                    <button onClick={() => acceptQuest(detail.rank)} disabled={busy}
                      className="btn-primary w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider">
                      {busy ? 'Engaging…' : `Engage the ${detail.rank}-Rank Boss`}
                    </button>
                    <button onClick={() => setConfirmAccept(false)} className="btn-quiet w-full py-2.5 rounded-lg text-sm font-semibold uppercase tracking-wider">Not yet</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setConfirmAccept(true)}
                      className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider"
                      style={{ background: `${RANK_COLORS[detail.rank]}1c`, border: `1px solid ${RANK_COLORS[detail.rank]}`, color: RANK_COLORS[detail.rank], boxShadow: `0 0 20px ${RANK_COLORS[detail.rank]}33` }}>
                      Accept This Boss
                    </button>
                    <button onClick={() => setDetailRank(null)} className="btn-quiet w-full py-2.5 rounded-lg text-sm font-semibold uppercase tracking-wider">Back to board</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Shell>
    );
  }

  // ── No quest and no offers (edge): prompt to summon ──
  if (!quest) {
    return (
      <Shell title="Boss Board">
        <div className="sys-panel rounded-xl p-8 text-center sys-appear">
          <Corners />
          <p className="sys-mono text-[11px] font-bold uppercase mb-3" style={{ color: SYS }}>[ Standby ]</p>
          <h2 className="text-lg font-black mb-4 text-white sys-glow" style={{ fontFamily: 'var(--font-jakarta)' }}>No bosses posted this week</h2>
          {error === 'failed' && <p className="text-sm text-danger sys-mono uppercase text-[12px] mb-3">[ System error — try again ]</p>}
          <button onClick={generateBoard} disabled={busy} className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bolt</span>Summon the Board
          </button>
        </div>
      </Shell>
    );
  }

  // ── Active / completed boss ──
  const color = RANK_COLORS[quest.rank];
  const isCompleted = quest.status === 'completed';
  const panelClass = isCompleted ? 'sys-panel sys-panel-done' : quest.rank === 'S' ? 'sys-panel sys-panel-gold' : 'sys-panel';

  return (
    <Shell title="Boss Fight">
      <div className={`${panelClass} rounded-xl overflow-hidden sys-appear ${celebrate ? 'celebrate-burst' : ''}`}>
        <Corners color={isCompleted ? '#c3f400' : color} />
        <QuestBody quest={quest} completed={isCompleted} celebrate={celebrate} />
        <div className="px-6 pb-6">
          {!isCompleted ? (
            <button onClick={completeQuest} disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all"
              style={{ background: `${color}1c`, border: `1px solid ${color}`, color, boxShadow: `0 0 20px ${color}33` }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
              {busy ? 'Recording…' : 'Boss Defeated'}
            </button>
          ) : (
            <div className="rounded-lg p-4 flex items-center gap-3" style={{ background: 'rgba(195,244,0,0.06)', border: '1px solid rgba(195,244,0,0.22)' }}>
              <span className="material-symbols-outlined celebrate-icon" style={{ fontSize: '24px', color: '#c3f400' }}>military_tech</span>
              <div>
                <p className="text-sm font-bold text-ink">Boss defeated — {quest.totalXp} XP absorbed.</p>
                <p className="sys-mono text-[10px] uppercase" style={{ color: 'rgba(140,144,161,0.8)' }}>A new board is posted next week</p>
              </div>
            </div>
          )}
          {error === 'failed' && <p className="text-sm text-danger sys-mono uppercase text-[12px] mt-3">[ System error — try again ]</p>}
        </div>
      </div>
    </Shell>
  );
}

// Shared quest window body (used by the board detail modal + the active view).
function QuestBody({ quest, completed, celebrate }: { quest: Quest; completed?: boolean; celebrate?: boolean }) {
  const color = RANK_COLORS[quest.rank];
  return (
    <>
      <div className="flex items-center gap-2 px-5 py-2.5" style={{ borderBottom: `1px solid ${color}33`, background: `${color}12` }}>
        <span className="sys-glow" style={{ color }}>◈</span>
        <p className="sys-mono text-[11px] font-bold uppercase" style={{ color }}>{completed ? 'Boss Defeated' : `Rank ${quest.rank} Boss`}</p>
        <span className="sys-mono text-[10px] uppercase ml-auto flex items-center gap-1" style={{ color: 'rgba(193,198,216,0.5)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>schedule</span>~{quest.estHours}h
        </span>
      </div>

      <div className="px-6 pt-5 pb-5">
        <div className="flex items-start gap-4 mb-4">
          <Sigil rank={quest.rank} size={52} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-white leading-tight sys-glow" style={{ fontFamily: 'var(--font-jakarta)' }}>{quest.title}</h2>
            {(quest.targetPillar || quest.targetSubCell) && (
              <p className="sys-mono text-[10px] uppercase mt-1 truncate" style={{ color: 'rgba(140,198,255,0.6)' }}>
                {quest.targetPillar}{quest.targetSubCell ? ` › ${quest.targetSubCell}` : ''}
              </p>
            )}
          </div>
          {completed && (
            <span className={`${celebrate ? 'sys-stamp' : ''} sys-mono text-[11px] font-black uppercase px-2 py-1 rounded flex-shrink-0`}
              style={{ border: '2px solid #c3f400', color: '#c3f400', textShadow: '0 0 10px rgba(195,244,0,0.6)' }}>Clear</span>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="sys-mono text-[11px] font-bold uppercase mb-1.5" style={{ color: `${color}bb` }}>▸ Objective</p>
            <p className="text-sm leading-relaxed text-ink-2">{quest.objective}</p>
          </div>
          <div>
            <p className="sys-mono text-[11px] font-bold uppercase mb-1.5" style={{ color: `${color}bb` }}>▸ Victory Condition</p>
            <p className="text-sm leading-relaxed text-ink-2">{quest.victoryCondition}</p>
          </div>
          <div>
            <p className="sys-mono text-[11px] font-bold uppercase mb-2.5" style={{ color: 'rgba(140,198,255,0.7)' }}>◆ Rewards · {quest.totalXp} XP {completed ? '· Absorbed' : ''}</p>
            <Rewards skillXp={quest.skillXp} total={quest.totalXp} glow={completed} />
          </div>
          {quest.isFallback && !completed && (
            <p className="sys-mono text-[10px] uppercase flex items-center gap-1.5" style={{ color: 'rgba(140,144,161,0.7)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>wifi_off</span>
              Oracle offline — boss forged by the System alone
            </p>
          )}
        </div>
      </div>
    </>
  );
}
