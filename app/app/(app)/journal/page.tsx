'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

const RichEditor = dynamic(() => import('@/components/RichEditor'), { ssr: false });

type JournalEntry = {
  id: number; title: string; content: string; mood: string;
  is_favourite: boolean; created_at: string; updated_at: string;
};

const MOODS = [
  { value: 'elite',     emoji: '🔥', label: 'Fired Up',   color: '#ffd700' },
  { value: 'focused',   emoji: '⚡', label: 'Focused',    color: '#afc6ff' },
  { value: 'resilient', emoji: '💪', label: 'Resilient',  color: '#c3f400' },
  { value: 'neutral',   emoji: '😐', label: 'Neutral',    color: '#8c90a1' },
  { value: 'tired',     emoji: '😴', label: 'Tired',      color: '#c1c6d8' },
  { value: 'tough',     emoji: '🥊', label: 'Tough Day',  color: '#ffb4ab' },
];

function getMood(value: string) { return MOODS.find(m => m.value === value) || MOODS[3]; }
function wordCount(text: string) {
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain ? plain.split(' ').length : 0;
}
function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<JournalEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', mood: 'focused' });
  const [search, setSearch] = useState('');
  const [filterMood, setFilterMood] = useState<string | null>(null);
  const [filterFavourites, setFilterFavourites] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const filterRef = useRef<HTMLDivElement>(null);

  const fetchEntries = useCallback(async () => {
    const res = await fetch('/api/journal');
    const data = await res.json();
    const list: JournalEntry[] = data.entries || [];
    setEntries(list);
    if (list.length > 0 && !active) setActive(list[0]);
    setLoading(false);
  }, [active]);

  useEffect(() => { fetchEntries(); }, []);

  // Close filter dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
    }
    if (showFilter) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showFilter]);

  function startNew() {
    setActive(null);
    setForm({ title: '', content: '', mood: 'focused' });
    setIsEditing(true);
    setMobileView('detail');
  }

  function startEdit(entry: JournalEntry) {
    setActive(entry);
    setForm({ title: entry.title, content: entry.content, mood: entry.mood });
    setIsEditing(true);
    setMobileView('detail');
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    if (active && isEditing && entries.find(e => e.id === active.id)) {
      await fetch('/api/journal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: active.id, ...form }) });
    } else {
      await fetch('/api/journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    }
    setSaving(false);
    setIsEditing(false);
    const res = await fetch('/api/journal');
    const data = await res.json();
    const list: JournalEntry[] = data.entries || [];
    setEntries(list);
    setActive(list[0] || null);
  }

  async function deleteEntry(id: number) {
    await fetch('/api/journal', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    const newList = entries.filter(e => e.id !== id);
    setEntries(newList);
    setActive(newList[0] || null);
    setIsEditing(false);
  }

  async function toggleFavourite(entry: JournalEntry) {
    const newVal = !entry.is_favourite;
    await fetch('/api/journal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: entry.id, is_favourite: newVal }) });
    const updated = entries.map(e => e.id === entry.id ? { ...e, is_favourite: newVal } : e);
    setEntries(updated);
    if (active?.id === entry.id) setActive({ ...entry, is_favourite: newVal });
  }

  const activeFilter = filterMood || filterFavourites;

  const filtered = entries.filter(e => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || stripHtml(e.content).toLowerCase().includes(search.toLowerCase());
    const matchMood = !filterMood || e.mood === filterMood;
    const matchFav = !filterFavourites || e.is_favourite;
    return matchSearch && matchMood && matchFav;
  });

  return (
    <div className="md:flex md:h-[calc(100vh-80px)] md:overflow-hidden" style={{ background: '#0A0A0F' }}>
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'rgba(175,198,255,0.04)', filter: 'blur(120px)' }} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'rgba(200,99,251,0.03)', filter: 'blur(100px)' }} />

      {/* ---- Left: Archive sidebar ---- */}
      <div className={`${mobileView === 'detail' ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 flex-col md:h-full border-r relative z-10`}
        style={{ background: 'rgba(27,27,32,0.5)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,0.05)' }}>

        <div className="px-3 pt-4 pb-2 flex-shrink-0">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-base" style={{ color: '#e4e1e9' }}>Archive</h3>
            <button onClick={startNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: '#548dff', color: '#fff' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#fff' }}>edit_note</span>
              <span style={{ color: '#fff' }}>New</span>
            </button>
          </div>

          {/* Search + filter — same width as entry list */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#8c90a1', fontSize: '15px' }}>search</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Find a memory..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none transition-all"
                style={{ background: 'rgba(42,41,47,0.6)', border: '1px solid rgba(255,255,255,0.08)', color: '#e4e1e9' }}
                onFocus={e => e.target.style.borderColor = 'rgba(175,198,255,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            {/* Filter button + dropdown */}
            <div className="relative flex-shrink-0" ref={filterRef}>
              <button onClick={() => setShowFilter(v => !v)}
                className="flex items-center justify-center rounded-lg transition-all"
                style={{
                  width: 36, height: 36,
                  background: activeFilter ? 'rgba(175,198,255,0.15)' : 'rgba(42,41,47,0.6)',
                  border: `1px solid ${activeFilter ? 'rgba(175,198,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: activeFilter ? '#afc6ff' : '#8c90a1',
                }}>
                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>filter_list</span>
              </button>

              {showFilter && (
                <div className="absolute right-0 top-[calc(100%+6px)] w-48 rounded-2xl overflow-hidden z-20 animate-fade-in"
                  style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#8c90a1' }}>Filter by</p>
                  </div>

                  {/* Favourites */}
                  <button onClick={() => { setFilterFavourites(v => !v); setFilterMood(null); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm transition-colors"
                    style={{ color: filterFavourites ? '#ffd700' : '#c1c6d8', background: filterFavourites ? 'rgba(255,215,0,0.08)' : 'transparent' }}
                    onMouseEnter={e => { if (!filterFavourites) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { if (!filterFavourites) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: filterFavourites ? "'FILL' 1" : "'FILL' 0", color: '#ffd700' }}>star</span>
                    Favourites
                  </button>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />

                  {/* Mood filters */}
                  {MOODS.map(m => (
                    <button key={m.value} onClick={() => { setFilterMood(filterMood === m.value ? null : m.value); setFilterFavourites(false); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors"
                      style={{ color: filterMood === m.value ? m.color : '#c1c6d8', background: filterMood === m.value ? `${m.color}12` : 'transparent' }}
                      onMouseEnter={e => { if (filterMood !== m.value) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={e => { if (filterMood !== m.value) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <span>{m.emoji}</span>
                      {m.label}
                    </button>
                  ))}

                  {/* Clear filter */}
                  {activeFilter && (
                    <>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />
                      <button onClick={() => { setFilterMood(null); setFilterFavourites(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-bold transition-colors"
                        style={{ color: '#8c90a1' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ffb4ab'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#8c90a1'}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                        Clear filter
                      </button>
                    </>
                  )}
                  <div className="pb-1" />
                </div>
              )}
            </div>
          </div>

          {/* Active filter chip */}
          {activeFilter && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: filterFavourites ? 'rgba(255,215,0,0.12)' : `${getMood(filterMood!).color}12`, color: filterFavourites ? '#ffd700' : getMood(filterMood!).color, border: `1px solid ${filterFavourites ? 'rgba(255,215,0,0.2)' : getMood(filterMood!).color + '25'}` }}>
                {filterFavourites ? '⭐ Favourites' : `${getMood(filterMood!).emoji} ${getMood(filterMood!).label}`}
              </span>
            </div>
          )}
        </div>

        {/* Entry list */}
        <div className="md:flex-1 md:overflow-y-auto md:custom-scrollbar px-3 pb-6 space-y-1.5 pt-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="material-symbols-outlined animate-spin" style={{ color: '#afc6ff' }}>progress_activity</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-4xl mb-3 block" style={{ color: '#414655' }}>menu_book</span>
              <p className="text-sm" style={{ color: '#8c90a1' }}>{search || activeFilter ? 'No matching entries' : 'No entries yet'}</p>
            </div>
          ) : (
            filtered.map(entry => {
              const mood = getMood(entry.mood);
              const isActive = active?.id === entry.id && !isEditing;
              return (
                <button key={entry.id} onClick={() => { setActive(entry); setIsEditing(false); setMobileView('detail'); }}
                  className="w-full text-left p-3.5 rounded-xl transition-all"
                  style={isActive
                    ? { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(175,198,255,0.2)' }
                    : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold tracking-widest uppercase" style={{ color: isActive ? '#afc6ff' : '#8c90a1' }}>
                      {new Date(entry.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); toggleFavourite(entry); }}
                      className="flex items-center justify-center rounded transition-colors"
                      style={{ width: 20, height: 20, color: entry.is_favourite ? '#ffd700' : 'rgba(255,255,255,0.2)', flexShrink: 0 }}
                      onMouseEnter={e => { if (!entry.is_favourite) (e.currentTarget as HTMLElement).style.color = '#ffd700'; }}
                      onMouseLeave={e => { if (!entry.is_favourite) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: entry.is_favourite ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                    </button>
                  </div>
                  <h4 className="font-bold text-[15px] mb-1 text-left" style={{ color: isActive ? '#e4e1e9' : '#c1c6d8' }}>
                    {entry.title}
                  </h4>
                  {entry.content && (
                    <p className="text-xs text-left mb-2" style={{ color: '#6b7280', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                      {stripHtml(entry.content)}
                    </p>
                  )}
                  {/* Mood tag */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: `${mood.color}12`, color: mood.color, border: `1px solid ${mood.color}25` }}>
                    {mood.emoji} {mood.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ---- Right: Editor / Viewer ---- */}
      <div className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-1 flex-col md:h-full md:overflow-hidden relative z-10`}>

        {/* Mobile back button */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 flex-shrink-0 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,15,0.5)' }}>
          <button onClick={() => setMobileView('list')}
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: '#afc6ff' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
            Archive
          </button>
        </div>

        {isEditing ? (
          /* ---- EDITING VIEW ---- */
          <>
            <div className="px-6 md:px-10 pt-6 flex-shrink-0">
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Entry title..."
                autoCapitalize="sentences"
                className="w-full bg-transparent text-3xl font-black tracking-tight outline-none mb-4"
                style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              />
              <div className="flex gap-2 flex-wrap mb-1">
                {MOODS.map(m => (
                  <button key={m.value} onClick={() => setForm(f => ({ ...f, mood: m.value }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={form.mood === m.value
                      ? { background: `${m.color}20`, color: m.color, border: `1px solid ${m.color}50` }
                      : { background: 'rgba(255,255,255,0.04)', color: '#8c90a1', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:flex-1 md:overflow-y-auto px-6 md:px-10 py-4">
              <div className="glass-panel rounded-2xl border-l-4 overflow-hidden relative"
                style={{ borderLeftColor: '#afc6ff' }}>
                <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(175,198,255,0.05)' }} />
                <RichEditor content={form.content} onChange={html => setForm(f => ({ ...f, content: html }))} />
              </div>
            </div>

            <div className="flex-shrink-0 px-6 md:px-10 py-4 flex items-center justify-between border-t"
              style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,15,0.6)' }}>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#8c90a1' }}>Words</p>
                  <p className="font-bold" style={{ color: '#e4e1e9' }}>{wordCount(form.content)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#8c90a1' }}>Mood</p>
                  <p className="font-bold">{getMood(form.mood).emoji} <span style={{ color: getMood(form.mood).color }}>{getMood(form.mood).label}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setIsEditing(false); if (entries.length) setActive(entries[0]); }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Cancel</button>
                <button onClick={save} disabled={saving || !form.title.trim()}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all"
                  style={{ background: saving || !form.title.trim() ? 'rgba(175,198,255,0.4)' : '#548dff', color: '#ffffff', boxShadow: '0 0 15px rgba(84,141,255,0.3)' }}>
                  {saving ? 'Saving...' : 'Submit'}
                </button>
              </div>
            </div>
          </>
        ) : active ? (
          /* ---- READING VIEW ---- */
          <>
            <div className="px-6 md:px-10 py-8 flex flex-col gap-4 md:flex-1 md:overflow-hidden md:min-h-0">
              {/* Header — column on mobile so title takes full width */}
              <div className="flex-shrink-0 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#8c90a1' }}>
                    {new Date(active.created_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}
                  </p>
                  <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white" style={{ fontFamily: 'var(--font-jakarta)', lineHeight: 1.1 }}>
                    {active.title}
                  </h1>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: `${getMood(active.mood).color}15`, color: getMood(active.mood).color, border: `1px solid ${getMood(active.mood).color}30` }}>
                      {getMood(active.mood).emoji} {getMood(active.mood).label}
                    </span>
                    <span className="text-xs" style={{ color: '#414655' }}>{wordCount(active.content)} words</span>
                  </div>
                </div>
                {/* Actions: star, edit, delete */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleFavourite(active)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl transition-all"
                    style={{ background: active.is_favourite ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.05)', border: `1px solid ${active.is_favourite ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.08)'}`, color: active.is_favourite ? '#ffd700' : '#8c90a1' }}
                    onMouseEnter={e => { if (!active.is_favourite) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,215,0,0.1)'; (e.currentTarget as HTMLElement).style.color = '#ffd700'; } }}
                    onMouseLeave={e => { if (!active.is_favourite) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#8c90a1'; } }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: active.is_favourite ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                  </button>
                  <button onClick={() => startEdit(active)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#8c90a1' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#afc6ff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8c90a1'; }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                  </button>
                  <button onClick={() => deleteEntry(active.id)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#8c90a1' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ffb4ab'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8c90a1'; }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                  </button>
                </div>
              </div>

              {/* Content panel — natural height on mobile, internal scroll on desktop */}
              <div className="glass-panel rounded-2xl border-l-4 shrink-0 md:shrink md:overflow-y-auto md:custom-scrollbar md:min-h-0 overflow-x-hidden"
                style={{ borderLeftColor: '#afc6ff', flexGrow: 0, flexBasis: 'auto' }}>
                <div className="px-5 py-5">
                  {active.content && active.content !== '<p></p>' ? (
                    <div className="rich-editor-content" style={{ color: '#c1c6d8', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                      dangerouslySetInnerHTML={{ __html: active.content }} />
                  ) : (
                    <p style={{ color: '#414655', fontStyle: 'italic' }}>No content written...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 md:px-10 py-4 flex items-center justify-between border-t flex-shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,15,0.6)' }}>
              <div className="flex gap-6">
                <div><p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#8c90a1' }}>Words</p>
                  <p className="font-bold" style={{ color: '#e4e1e9' }}>{wordCount(active.content)}</p></div>
                <div><p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#8c90a1' }}>Entries</p>
                  <p className="font-bold" style={{ color: '#e4e1e9' }}>{entries.length}</p></div>
              </div>
              <button onClick={startNew}
                className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all"
                style={{ background: '#548dff', color: '#ffffff', boxShadow: '0 0 15px rgba(84,141,255,0.25)' }}>
                New Entry
              </button>
            </div>
          </>
        ) : (
          /* ---- EMPTY STATE ---- */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <span className="material-symbols-outlined text-6xl mb-4" style={{ color: '#414655' }}>menu_book</span>
            <p className="text-xl font-black mb-2" style={{ fontFamily: 'var(--font-jakarta)', color: '#8c90a1' }}>Your journal awaits</p>
            <p className="text-sm mb-6" style={{ color: '#414655' }}>Document your journey, one entry at a time.</p>
            <button onClick={startNew}
              className="px-6 py-3 rounded-xl font-bold transition-all"
              style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 15px rgba(175,198,255,0.25)' }}>
              Write First Entry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
