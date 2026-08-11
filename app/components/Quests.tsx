'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { RANK_CONFIG, RANKS, SKILLS, type Rank } from '@/lib/weeklyQuest';

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

// Each rank gets a colour so it never reads by letter alone.
const RANK_COLORS: Record<Rank, string> = {
  C: '#8c90a1', B: '#4ecdc4', A: '#afc6ff', S: '#ffd700',
};

type Quest = {
  id: number;
  version: number;
  status: string;
  title: string;
  instructions: string;
  successCriteria: string;
  rationale: string;
  rank: Rank;
  skillXp: Record<string, number>;
  durationMinutes: number;
  sourcePillar: string;
  isFallback: boolean;
  completedAt: string | null;
};

type State = {
  enabled: boolean;
  timezone: string;
  weekStart: string;
  weekLabel: string;
  gridReady: 'empty' | 'goal-only' | 'ready';
  generating: boolean;
  rerollAvailable: boolean;
  quest: Quest | null;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function Quests() {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRank, setSelectedRank] = useState<Rank | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rerollConfirm, setRerollConfirm] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

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

  async function pollUntilReady() {
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const res = await fetch('/api/weekly-quest');
      if (!res.ok) continue;
      const d: State = await res.json();
      if (d.quest || !d.generating) { setState(d); return; }
    }
    await fetchState();
  }

  async function beginQuest() {
    if (!selectedRank) return;
    setBusy(true); setGenerating(true); setError(null);
    try {
      const res = await fetch('/api/weekly-quest/ensure', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rank: selectedRank }),
      });
      if (res.status === 422) { setError('grid'); await fetchState(); return; }
      if (res.status === 202) { await pollUntilReady(); return; }
      if (!res.ok) { setError('failed'); return; }
      const d = await res.json();
      if (d.quest) setState(s => s ? { ...s, quest: d.quest, generating: false, rerollAvailable: d.quest.version === 1 && d.quest.status === 'active' } : s);
      else await pollUntilReady();
    } catch { setError('failed'); }
    finally { setBusy(false); setGenerating(false); }
  }

  async function doReroll() {
    setRerollConfirm(false);
    setBusy(true); setGenerating(true); setError(null);
    try {
      const res = await fetch('/api/weekly-quest/reroll', { method: 'POST' });
      if (res.status === 202) { await pollUntilReady(); return; }
      if (!res.ok) { setError('failed'); return; }
      const d = await res.json();
      if (d.quest) setState(s => s ? { ...s, quest: d.quest, rerollAvailable: false } : s);
      else await pollUntilReady();
    } catch { setError('failed'); }
    finally { setBusy(false); setGenerating(false); }
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
        setTimeout(() => setCelebrate(false), 900);
        setState(s => s && s.quest ? { ...s, quest: { ...s.quest, status: 'completed' }, rerollAvailable: false } : s);
      } else setError('failed');
    } catch { setError('failed'); }
    finally { setBusy(false); }
  }

  // ── Header (shared) ──
  const header = (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
      <div>
        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#afc6ff' }}>Weekly Challenge</p>
        <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>Quests</h1>
        {state && <p className="text-sm mt-1 text-muted">Week of {state.weekLabel}</p>}
      </div>
    </div>
  );

  function Shell({ children }: { children: React.ReactNode }) {
    return <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto">{header}{children}</div>;
  }

  // ── Loading ──
  if (loading) {
    return (
      <Shell>
        <div className="rounded-3xl p-8 animate-pulse" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minHeight: 260 }} />
      </Shell>
    );
  }

  if (!state) {
    return <Shell><p className="text-muted">Could not load quests.</p></Shell>;
  }

  // ── Disabled → consent card ──
  if (!state.enabled) {
    return (
      <Shell>
        <div className="rounded-3xl p-7 md:p-9 animate-slide-up" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'rgba(175,198,255,0.1)', border: '1px solid rgba(175,198,255,0.2)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#afc6ff' }}>swords</span>
          </div>
          <h2 className="text-xl font-black mb-2 text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>Weekly AI Quests</h2>
          <p className="text-sm leading-relaxed text-ink-2 mb-4">
            Each week, Mission Map can craft one personal quest that pushes you toward your ultimate mission —
            drawn from your Mandala grid, your progress, and your past quests. You choose the challenge rank; completing it earns skill XP.
          </p>
          <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <div className="flex gap-2.5">
              <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '18px', color: '#ffd700' }}>info</span>
              <p className="text-xs leading-relaxed text-ink-2">
                To generate a quest, relevant text from your grid and progress is sent to <strong>Google Gemini</strong> for processing.
                This is not local or private, and free availability isn&apos;t guaranteed. You can turn this off any time in Settings.
              </p>
            </div>
          </div>
          <button onClick={enableFeature} disabled={enabling}
            className="btn-primary flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm w-full sm:w-auto">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
            {enabling ? 'Enabling…' : 'Enable Weekly Quests'}
          </button>
        </div>
      </Shell>
    );
  }

  // ── Grid incomplete ──
  if (state.gridReady === 'empty' || error === 'grid') {
    return (
      <Shell>
        <div className="rounded-3xl p-8 text-center animate-slide-up" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
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
  const isCompleted = quest?.status === 'completed';

  // ── Generating ──
  if (generating || state.generating || (busy && !quest)) {
    return (
      <Shell>
        <div className="rounded-3xl p-8 flex flex-col items-center text-center animate-fade-in" role="status" aria-live="polite"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minHeight: 260 }}>
          <span className="material-symbols-outlined animate-spin mb-4" style={{ color: '#afc6ff', fontSize: '40px' }}>progress_activity</span>
          <h2 className="text-lg font-black mb-1 text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>Forging your quest…</h2>
          <p className="text-sm text-muted">Reading your mission and shaping this week&apos;s challenge.</p>
        </div>
      </Shell>
    );
  }

  // ── No quest yet → rank selector ──
  if (!quest) {
    return (
      <Shell>
        <div className="animate-slide-up">
          <div className="mb-5">
            <h2 className="text-lg font-black text-white mb-1" style={{ fontFamily: 'var(--font-jakarta)' }}>Choose your challenge</h2>
            <p className="text-sm text-muted">Pick a rank for this week&apos;s quest. Higher ranks mean more effort and more XP — every rank stays safe and realistic.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 mb-6" role="radiogroup" aria-label="Quest rank">
            {RANKS.map(r => {
              const cfg = RANK_CONFIG[r];
              const active = selectedRank === r;
              const color = RANK_COLORS[r];
              return (
                <button key={r} role="radio" aria-checked={active}
                  onClick={() => setSelectedRank(r)}
                  className="text-left rounded-2xl p-4 transition-all"
                  style={{
                    background: active ? `${color}1f` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: active ? `0 0 20px ${color}33` : 'none',
                  }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0"
                      style={{ background: `${color}22`, border: `1px solid ${color}55`, color, fontFamily: 'var(--font-jakarta)' }}>
                      {r}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink">{cfg.minMinutes}–{cfg.maxMinutes} min</p>
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{cfg.minXp}–{cfg.maxXp} XP</p>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted">{cfg.blurb}</p>
                </button>
              );
            })}
          </div>
          {state.gridReady === 'goal-only' && (
            <p className="text-xs text-muted mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: '#ffd700' }}>info</span>
              Only your centre goal is filled — this quest will help you define your first pillar.
            </p>
          )}
          {error === 'failed' && <p className="text-sm text-danger mb-3">Something went wrong. Please try again.</p>}
          <button onClick={beginQuest} disabled={!selectedRank || busy}
            className="btn-primary flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm w-full sm:w-auto">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>swords</span>
            Begin {selectedRank ? `${selectedRank}-Rank ` : ''}Quest
          </button>
        </div>
      </Shell>
    );
  }

  // ── Active / completed quest card ──
  const color = RANK_COLORS[quest.rank];
  const activeSkills = SKILLS.filter(s => (quest.skillXp[s] || 0) > 0);

  return (
    <Shell>
      <div className={`rounded-3xl overflow-hidden animate-slide-up ${celebrate ? 'celebrate-burst' : ''}`}
        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${isCompleted ? 'rgba(195,244,0,0.3)' : 'rgba(255,255,255,0.1)'}` }}>

        {/* Top banner */}
        <div className="px-6 pt-6 pb-5" style={{ background: `linear-gradient(135deg, ${color}14, transparent)` }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl flex-shrink-0"
                style={{ background: `${color}22`, border: `1px solid ${color}55`, color, fontFamily: 'var(--font-jakarta)' }}>
                {quest.rank}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color }}>{quest.rank}-Rank Quest{quest.version === 2 ? ' · Reroll' : ''}</p>
                <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>schedule</span>
                  {quest.durationMinutes} min
                  {quest.sourcePillar && <><span>·</span><span className="truncate max-w-[140px]">{quest.sourcePillar}</span></>}
                </div>
              </div>
            </div>
            {isCompleted ? (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0"
                style={{ background: 'rgba(195,244,0,0.12)', border: '1px solid rgba(195,244,0,0.3)', color: '#c3f400' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>Completed
              </span>
            ) : quest.isFallback ? (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold flex-shrink-0"
                style={{ background: 'rgba(140,144,161,0.12)', border: '1px solid rgba(140,144,161,0.25)', color: '#8c90a1' }} title="Created without AI while the service was unavailable">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>bolt</span>Offline
              </span>
            ) : null}
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white leading-tight" style={{ fontFamily: 'var(--font-jakarta)' }}>{quest.title}</h2>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-1 flex flex-col gap-5">
          <Section icon="menu_book" label="The quest">
            <p className="text-sm leading-relaxed text-ink-2">{quest.instructions}</p>
          </Section>

          <Section icon="flag" label="Success criteria">
            <p className="text-sm leading-relaxed text-ink-2">{quest.successCriteria}</p>
          </Section>

          {quest.rationale && (
            <Section icon="target" label="Why this">
              <p className="text-sm leading-relaxed text-muted italic">{quest.rationale}</p>
            </Section>
          )}

          {/* XP preview */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#8c90a1' }}>military_tech</span>
              <p className="text-xs font-bold tracking-widest uppercase text-muted">Reward · {isCompleted ? 'XP earned' : 'XP on completion'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeSkills.map(s => (
                <span key={s} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold"
                  style={{ background: `${SKILL_COLORS[s]}14`, border: `1px solid ${SKILL_COLORS[s]}33`, color: SKILL_COLORS[s] }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{SKILL_ICONS[s]}</span>
                  <span className="capitalize">{s}</span>
                  <span style={{ color: '#e4e1e9' }}>+{quest.skillXp[s]}</span>
                </span>
              ))}
              {activeSkills.length === 0 && <span className="text-xs text-faint">No XP allocated.</span>}
            </div>
          </div>

          {/* Actions */}
          {!isCompleted && (
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button onClick={completeQuest} disabled={busy}
                className="btn-primary flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
                {busy ? 'Saving…' : 'Complete Quest'}
              </button>
              {state.rerollAvailable && (
                <button onClick={() => setRerollConfirm(true)} disabled={busy}
                  className="btn-ghost flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-sm">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>casino</span>
                  Reroll · 1 left
                </button>
              )}
            </div>
          )}

          {isCompleted && (
            <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: 'rgba(195,244,0,0.06)', border: '1px solid rgba(195,244,0,0.2)' }}>
              <span className="material-symbols-outlined celebrate-icon" style={{ fontSize: '24px', color: '#c3f400' }}>military_tech</span>
              <div>
                <p className="text-sm font-bold text-ink">Quest complete — XP added to your skills.</p>
                <p className="text-xs text-muted">A new quest unlocks next week.</p>
              </div>
            </div>
          )}

          {error === 'failed' && <p className="text-sm text-danger">Something went wrong. Please try again.</p>}
        </div>
      </div>

      {/* Reroll confirmation */}
      {rerollConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setRerollConfirm(false)} role="dialog" aria-modal="true" aria-label="Confirm reroll">
          <div className="w-full max-w-sm rounded-3xl p-6 animate-slide-up" style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#ffd700' }}>casino</span>
              <h3 className="font-black text-base text-ink" style={{ fontFamily: 'var(--font-jakarta)' }}>Reroll this quest?</h3>
            </div>
            <p className="text-sm mb-5 leading-relaxed text-ink-2">
              You get <strong>one reroll per week</strong>. This replaces your current {quest.rank}-rank quest with a new one at the same rank — it can&apos;t be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRerollConfirm(false)} className="btn-quiet flex-1 py-2.5 rounded-xl text-sm font-semibold">Keep this one</button>
              <button onClick={doReroll} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)', color: '#ffd700' }}>Reroll</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Section({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#8c90a1' }}>{icon}</span>
        <p className="text-xs font-bold tracking-widest uppercase text-muted">{label}</p>
      </div>
      {children}
    </div>
  );
}
