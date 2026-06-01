'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import RadarChart from '@/components/RadarChart';

type Achievement = {
  id: number; title: string; description: string;
  trophy_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  is_locked: boolean; unlocked_at: string;
  vision_board_image_id?: number | null;
};

type SortMode = 'default' | 'not-earned' | 'grade-desc' | 'earn-date';

const TROPHY: Record<string, { color: string; glow: string; icon: string; label: string; iconColor: string }> = {
  platinum: { color: '#e5e7eb', glow: '0 0 30px rgba(229,231,235,0.35)', icon: 'diamond',           iconColor: '#ffffff',   label: 'Platinum' },
  gold:     { color: '#ffd700', glow: '0 0 30px rgba(255,215,0,0.35)',    icon: 'military_tech',     iconColor: '#facc15',   label: 'Gold'     },
  silver:   { color: '#cbd5e1', glow: '0 0 20px rgba(200,200,200,0.2)',   icon: 'workspace_premium', iconColor: '#94a3b8',   label: 'Silver'   },
  bronze:   { color: '#cd7f32', glow: '0 0 20px rgba(205,127,50,0.2)',    icon: 'military_tech',     iconColor: '#b45309',   label: 'Bronze'   },
};

const TIER_RANK: Record<string, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };

function sortAchievements(list: Achievement[], mode: SortMode): Achievement[] {
  const copy = [...list];
  if (mode === 'default') {
    // Bronze first → platinum, oldest first within tier, completed at end
    const locked = copy.filter(a => a.is_locked).sort((a, b) => {
      const td = TIER_RANK[a.trophy_tier] - TIER_RANK[b.trophy_tier];
      if (td !== 0) return td;
      return new Date(a.unlocked_at).getTime() - new Date(b.unlocked_at).getTime();
    });
    const unlocked = copy.filter(a => !a.is_locked).sort((a, b) =>
      new Date(a.unlocked_at).getTime() - new Date(b.unlocked_at).getTime()
    );
    return [...locked, ...unlocked];
  }
  if (mode === 'not-earned') {
    return copy.filter(a => a.is_locked).sort((a, b) => {
      const td = TIER_RANK[a.trophy_tier] - TIER_RANK[b.trophy_tier];
      if (td !== 0) return td;
      return new Date(a.unlocked_at).getTime() - new Date(b.unlocked_at).getTime();
    });
  }
  if (mode === 'grade-desc') {
    // Platinum → bronze, completed at end
    const locked = copy.filter(a => a.is_locked).sort((a, b) => TIER_RANK[b.trophy_tier] - TIER_RANK[a.trophy_tier]);
    const unlocked = copy.filter(a => !a.is_locked).sort((a, b) => TIER_RANK[b.trophy_tier] - TIER_RANK[a.trophy_tier]);
    return [...locked, ...unlocked];
  }
  if (mode === 'earn-date') {
    // Completed sorted newest first, then locked by oldest
    const unlocked = copy.filter(a => !a.is_locked).sort((a, b) =>
      new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime()
    );
    const locked = copy.filter(a => a.is_locked).sort((a, b) =>
      new Date(a.unlocked_at).getTime() - new Date(b.unlocked_at).getTime()
    );
    return [...unlocked, ...locked];
  }
  return copy;
}

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Achievement | null>(null);
  const [form, setForm] = useState({ title: '', description: '', trophy_tier: 'gold' as Achievement['trophy_tier'], is_locked: true });
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showAllAch, setShowAllAch] = useState(false);
  const [showAllDesktop, setShowAllDesktop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    const [achRes, statsRes] = await Promise.all([fetch('/api/achievements'), fetch('/api/stats')]);
    const achData = await achRes.json();
    const statsData = await statsRes.json();
    setAchievements(achData.achievements || []);
    setStats(statsData.stats || {});
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSortMenu(false);
    }
    if (showSortMenu) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showSortMenu]);

  function openAdd() {
    setEditItem(null);
    setForm({ title: '', description: '', trophy_tier: 'gold', is_locked: true });
    setShowModal(true);
  }
  function openEdit(ach: Achievement) {
    setEditItem(ach);
    setForm({ title: ach.title, description: ach.description, trophy_tier: ach.trophy_tier, is_locked: ach.is_locked });
    setShowModal(true);
  }
  async function save() {
    if (!form.title.trim()) return;
    if (editItem) {
      await fetch('/api/achievements', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editItem.id, ...form }) });
    } else {
      await fetch('/api/achievements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, is_locked: true }) });
    }
    setShowModal(false);
    fetchData();
  }
  async function markAchieved(ach: Achievement) {
    await fetch('/api/achievements', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ach.id, title: ach.title, description: ach.description, trophy_tier: ach.trophy_tier, is_locked: false }),
    });
    fetchData();
  }
  async function deleteAch(id: number) {
    await fetch('/api/achievements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setAchievements(prev => prev.filter(a => a.id !== id));
  }

  const unlocked = achievements.filter(a => !a.is_locked);
  const totalPoints = Object.values(stats).reduce((a, b) => a + b, 0);
  const tierCounts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  unlocked.forEach(a => tierCounts[a.trophy_tier]++);

  const sorted = sortAchievements(achievements, sortMode);

  const SORT_OPTIONS: { key: SortMode; label: string; sub?: string }[] = [
    { key: 'default',     label: 'Default order' },
    { key: 'not-earned',  label: 'Not earned' },
    { key: 'grade-desc',  label: 'Grade',   sub: '(Platinum → Bronze)' },
    { key: 'earn-date',   label: 'Earned',  sub: '(new → old)' },
  ];

  const activeSortLabel = SORT_OPTIONS.find(o => o.key === sortMode)?.label ?? 'Sort';

  return (
    <div className="px-4 md:px-8 py-4 max-w-6xl mx-auto">
      {/* Hero Banner */}
      <div className="relative w-full rounded-3xl overflow-hidden mb-6 group" style={{ minHeight: 180 }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0d1a35 0%, #1a0a2e 50%, #0A0A0F 100%)' }} />
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(175,198,255,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(200,99,251,0.3) 0%, transparent 50%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0A0A0F 0%, transparent 60%)' }} />
        <div className="relative z-10 p-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2" style={{ fontFamily: 'var(--font-jakarta)' }}>
              Mission Mastery
            </h2>
            <p className="text-sm leading-relaxed max-w-lg" style={{ color: '#c1c6d8' }}>
              Track every win. Bronze to platinum — each trophy marks a milestone on your path to legacy.
            </p>
          </div>
          <div className="flex gap-4 flex-shrink-0">
            <div className="glass-card px-6 py-4 rounded-2xl flex flex-col items-center">
              <span className="text-2xl font-black" style={{ color: '#afc6ff', fontFamily: 'var(--font-jakarta)' }}>
                {achievements.length ? Math.round((unlocked.length / achievements.length) * 100) : 0}%
              </span>
              <span className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color: '#8c90a1' }}>Progress</span>
            </div>
            <div className="glass-card px-6 py-4 rounded-2xl flex flex-col items-center">
              <span className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>
                {unlocked.length}/{achievements.length}
              </span>
              <span className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color: '#8c90a1' }}>Unlocked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sort row */}
      {achievements.length > 0 && (
        <div className="flex justify-end mb-4" ref={sortRef}>
          <div className="relative">
            <button onClick={() => setShowSortMenu(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: sortMode !== 'default' ? 'rgba(175,198,255,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${sortMode !== 'default' ? 'rgba(175,198,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
                color: sortMode !== 'default' ? '#afc6ff' : '#8c90a1',
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>sort</span>
              <span className="hidden sm:inline">{activeSortLabel}</span>
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-[calc(100%+6px)] rounded-2xl overflow-hidden z-20 animate-fade-in"
                style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)', width: 'max-content', minWidth: '180px' }}>
                <div className="px-3 pt-3 pb-1">
                  <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: '#8c90a1' }}>Sort by</p>
                </div>
                {SORT_OPTIONS.map(opt => (
                  <button key={opt.key} onClick={() => { setSortMode(opt.key); setShowSortMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm transition-colors"
                    style={{ color: sortMode === opt.key ? '#afc6ff' : '#c1c6d8', background: sortMode === opt.key ? 'rgba(175,198,255,0.08)' : 'transparent', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => { if (sortMode !== opt.key) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { if (sortMode !== opt.key) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    {sortMode === opt.key
                      ? <span className="material-symbols-outlined" style={{ fontSize: '14px', flexShrink: 0 }}>check</span>
                      : <span style={{ width: 14, flexShrink: 0 }} />}
                    <span>
                      {opt.label}
                      {opt.sub && <span style={{ fontSize: '11px', opacity: 0.6, marginLeft: 4 }}>{opt.sub}</span>}
                    </span>
                  </button>
                ))}
                <div className="pb-1" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trophy Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-3xl" style={{ color: '#afc6ff' }}>progress_activity</span>
        </div>
      ) : achievements.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <span className="material-symbols-outlined text-6xl mb-4" style={{ color: '#414655' }}>emoji_events</span>
          <p className="font-semibold text-lg mb-1" style={{ color: '#8c90a1' }}>No achievements yet</p>
          <p className="text-sm mb-6" style={{ color: '#414655' }}>Add your first trophy to start tracking your wins</p>
          <button onClick={openAdd} className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(175,198,255,0.1)', border: '1px solid rgba(175,198,255,0.2)', color: '#afc6ff' }}>
            + Add Achievement
          </button>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(isMobile ? (showAllAch ? sorted : sorted.slice(0, 3)) : (showAllDesktop ? sorted : sorted.slice(0, 8))).map(ach => {
            const t = TROPHY[ach.trophy_tier];
            const isLocked = ach.is_locked;
            return (
              <div key={ach.id}
                className={`relative rounded-3xl p-8 flex flex-col items-center text-center group cursor-pointer transition-all duration-300 hover:scale-[1.02] ${isLocked ? '' : `trophy-${ach.trophy_tier}`}`}
                style={isLocked
                  ? { minHeight: '390px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }
                  : { minHeight: '390px', boxShadow: t.glow }}>

                {/* Grade icon — top left for locked */}
                {isLocked && (
                  <div className="absolute top-3 left-3 z-10">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: t.iconColor + 'aa', fontVariationSettings: "'FILL' 1" }}>{t.icon}</span>
                  </div>
                )}

                {/* Edit/Delete on hover */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={() => openEdit(ach)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(20,20,28,0.85)', color: '#8c90a1' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#afc6ff'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#8c90a1'}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                  </button>
                  <button onClick={() => deleteAch(ach.id)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(20,20,28,0.85)', color: '#8c90a1' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ffb4ab'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#8c90a1'}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                  </button>
                </div>

                {/* Icon area */}
                <div className="w-24 h-24 mb-6 rounded-full flex items-center justify-center relative"
                  style={{ background: isLocked ? 'rgba(255,255,255,0.04)' : `${t.color}10` }}>
                  {isLocked ? (
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'rgba(255,255,255,0.15)' }}>lock</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: '64px', color: t.iconColor, fontVariationSettings: "'FILL' 1" }}>
                        {t.icon}
                      </span>
                      <div className="absolute inset-0 rounded-full opacity-30 group-hover:opacity-80 transition-opacity blur-xl"
                        style={{ background: t.color }} />
                    </>
                  )}
                </div>

                <h3 className="font-bold text-base mb-2" style={{ color: isLocked ? '#9ca3af' : '#e4e1e9', minHeight: '3rem' }}>
                  {ach.title}
                </h3>

                <p className="text-xs font-bold tracking-widest uppercase mb-4"
                  style={{ color: isLocked ? 'rgba(255,255,255,0.2)' : '#8c90a1' }}>
                  {t.label} Trophy
                </p>

                <div className="mt-auto pt-4 border-t w-full"
                  style={{ borderColor: isLocked ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)' }}>
                  <div style={{ minHeight: '2.75rem' }}>
                    {ach.description ? (
                      <p className="text-sm leading-relaxed"
                        style={{ color: isLocked ? '#6b7280' : '#8c90a1' }}>
                        {ach.description}
                      </p>
                    ) : null}
                  </div>
                  {!isLocked && (
                    <p className="text-sm font-bold mt-1" style={{ color: t.color }}>
                      Earned {new Date(ach.unlocked_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </p>
                  )}
                  {isLocked && (
                    <button
                      onClick={e => { e.stopPropagation(); markAchieved(ach); }}
                      className="mt-3 w-full py-2 rounded-xl text-xs font-bold tracking-widest uppercase transition-all"
                      style={{ background: 'rgba(195,244,0,0.1)', border: '1px solid rgba(195,244,0,0.25)', color: '#c3f400' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(195,244,0,0.2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(195,244,0,0.1)'; }}>
                      Complete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Show more — mobile */}
        {isMobile && !showAllAch && sorted.length > 3 && (
          <div className="flex justify-center mt-4 sm:hidden">
            <button onClick={() => setShowAllAch(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(175,198,255,0.1)', border: '1px solid rgba(175,198,255,0.2)', color: '#afc6ff' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>expand_more</span>
              Show {sorted.length - 3} more
            </button>
          </div>
        )}

        {/* Show more / less — desktop (2 rows = 8 trophies) */}
        {!isMobile && sorted.length > 8 && (
          <div className="hidden sm:flex justify-center mt-6">
            <button onClick={() => setShowAllDesktop(v => !v)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(175,198,255,0.08)', border: '1px solid rgba(175,198,255,0.18)', color: '#afc6ff' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.15)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.08)'}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showAllDesktop ? 'expand_less' : 'expand_more'}</span>
              {showAllDesktop ? 'Show less' : `Show ${sorted.length - 8} more`}
            </button>
          </div>
        )}
        </>
      )}

      {/* Tier Mastery + Radar */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-3xl p-8">
          <h4 className="text-xl font-black mb-1" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>Trophy Room</h4>
          <p className="text-sm mb-6" style={{ color: '#8c90a1' }}>Collect trophies to advance your standing.</p>
          <div className="flex flex-col gap-6">
            {(['platinum','gold','silver','bronze'] as const).map(tier => {
              const t = TROPHY[tier];
              const count = tierCounts[tier];
              const total = Math.max(count, 5);
              return (
                <div key={tier}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: t.iconColor, fontVariationSettings: "'FILL' 1" }}>{t.icon}</span>
                      <span className="text-xs font-bold tracking-widest uppercase" style={{ color: t.color }}>{t.label} Mastery</span>
                    </div>
                    <span className="font-bold text-sm" style={{ color: t.color }}>{count}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, (count / total) * 100)}%`, background: `linear-gradient(90deg, ${t.color}80, ${t.color})`, boxShadow: count > 0 ? `0 0 10px ${t.color}50` : 'none' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card rounded-3xl p-8">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xl font-black" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>Skill Radar</h4>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(175,198,255,0.1)', color: '#afc6ff', border: '1px solid rgba(175,198,255,0.2)' }}>
              {totalPoints} XP
            </span>
          </div>
          <RadarChart stats={stats} />
        </div>
      </div>

      {/* FAB */}
      <button onClick={openAdd}
        className="fixed bottom-24 md:bottom-8 right-6 md:right-8 w-16 h-16 rounded-full flex items-center justify-center z-40 transition-all hover:scale-110 active:scale-95"
        style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 30px rgba(175,198,255,0.4)', cursor: 'pointer' }}>
        <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'wght' 600" }}>add</span>
      </button>

      {/* Modal — click backdrop to close */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowModal(false)}>
          <div className="w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-6 animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>
                {editItem ? 'Edit Achievement' : 'New Achievement'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ color: '#8c90a1' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: '#c1c6d8' }}>Title</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. First Million, Run Marathon..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e1e9' }}
                  onFocus={e => e.target.style.borderColor = '#afc6ff'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div>
                <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: '#c1c6d8' }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="Describe this achievement or goal..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm resize-none outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e1e9' }}
                  onFocus={e => e.target.style.borderColor = '#afc6ff'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div>
                <label className="text-xs font-bold tracking-widest uppercase mb-2 block" style={{ color: '#c1c6d8' }}>Trophy Tier</label>
                <div className={`grid grid-cols-4 gap-2${editItem?.vision_board_image_id ? ' opacity-50 pointer-events-none' : ''}`}>
                  {(['bronze','silver','gold','platinum'] as const).map(tier => {
                    const t = TROPHY[tier];
                    const sel = form.trophy_tier === tier;
                    return (
                      <button key={tier} onClick={() => setForm(f => ({ ...f, trophy_tier: tier }))}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
                        style={sel ? {
                          background: `${t.color}18`,
                          border: `2px solid ${t.color}`,
                          boxShadow: `0 0 14px ${t.color}30`,
                        } : {
                          background: 'rgba(255,255,255,0.04)',
                          border: '2px solid rgba(255,255,255,0.08)',
                        }}>
                        <span className="material-symbols-outlined"
                          style={{ fontSize: '28px', fontVariationSettings: "'FILL' 1",
                            color: sel ? t.iconColor : 'rgba(255,255,255,0.2)' }}>
                          {t.icon}
                        </span>
                        <span className="text-xs font-bold"
                          style={{ color: sel ? t.color : 'rgba(255,255,255,0.25)' }}>
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {editItem?.vision_board_image_id && (
                  <p className="text-xs mt-2 flex items-center gap-1" style={{ color: '#8c90a1' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '12px', verticalAlign: 'middle' }}>lock</span>
                    Grade locked — vision board trophies are always platinum
                  </p>
                )}
              </div>

              {editItem && (
                <button
                  onClick={() => setForm(f => ({ ...f, is_locked: !f.is_locked }))}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all"
                  style={form.is_locked
                    ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#8c90a1' }
                    : { background: 'rgba(195,244,0,0.08)', border: '1px solid rgba(195,244,0,0.25)', color: '#c3f400' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {form.is_locked ? 'lock' : 'emoji_events'}
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-semibold">{form.is_locked ? 'Not yet achieved' : 'Achieved'}</p>
                    <p className="text-xs" style={{ color: '#6b7280' }}>Tap to toggle</p>
                  </div>
                </button>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Cancel</button>
                <button onClick={save} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 15px rgba(175,198,255,0.25)' }}>
                  {editItem ? 'Save' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
