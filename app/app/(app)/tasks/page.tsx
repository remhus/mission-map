'use client';

import { useState, useEffect, useCallback } from 'react';

type Task = {
  id: number; title: string; skill: string; duration_minutes: number;
  time_of_day: string | null; day_of_week: number; every_day: boolean;
  is_completed: boolean; completed_at: string | null;
};


const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SKILLS = ['energy','intelligence','strength','bravery','wealth','discipline','wisdom','influence'];

const SKILL_META: Record<string, { icon: string; color: string; bg: string }> = {
  energy:        { icon: 'bolt',                    color: '#ffd700', bg: 'rgba(255,215,0,0.15)'     },
  intelligence:  { icon: 'psychology',              color: '#afc6ff', bg: 'rgba(175,198,255,0.15)'   },
  strength:      { icon: 'fitness_center',           color: '#ff6b6b', bg: 'rgba(255,107,107,0.15)'   },
  bravery:       { icon: 'shield',                  color: '#c3f400', bg: 'rgba(195,244,0,0.15)'     },
  wealth:        { icon: 'payments',                color: '#4ecdc4', bg: 'rgba(78,205,196,0.15)'    },
  discipline:    { icon: 'military_tech',            color: '#e9b3ff', bg: 'rgba(233,179,255,0.15)'   },
  wisdom:        { icon: 'auto_stories',             color: '#f97316', bg: 'rgba(249,115,22,0.15)'    },
  influence:     { icon: 'public',                  color: '#fd79a8', bg: 'rgba(253,121,168,0.15)'   },
};

function getTodayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function getDateForDay(dayIndex: number) {
  const today = new Date();
  const todayDow = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const diff = dayIndex - todayDow;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d.getDate();
}

// Returns YYYY-MM-DD for the calendar date of a given day-tab index
function getISODateForDay(dayIndex: number): string {
  const today = new Date();
  const todayDow = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const diff = dayIndex - todayDow;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function isToday(dateStr: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

// For every_day tasks: show as complete only if completed on the specific day being viewed.
// This allows retroactive logging for past days.
function isEffectivelyComplete(task: Task, activeDay: number): boolean {
  if (task.every_day) {
    if (!task.is_completed || !task.completed_at) return false;
    const targetDate = getISODateForDay(activeDay);
    const completedDate = task.completed_at.split('T')[0];
    return completedDate === targetDate;
  }
  return task.is_completed;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(getTodayIndex());
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState({
    title: '', skill: 'energy', duration_minutes: 30,
    time_of_day: '', day_of_week: 0, every_day: false,
  });
  const [showSchedule, setShowSchedule] = useState(false);

  const fetchTasks = useCallback(async () => {
    const res = await fetch('/api/tasks');
    const data = await res.json();
    setTasks(data.tasks || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);


  function openAdd() {
    setEditTask(null);
    setForm({ title: '', skill: 'energy', duration_minutes: 30, time_of_day: '', day_of_week: activeDay, every_day: false });
    setShowModal(true);
  }
  function openEdit(task: Task) {
    setEditTask(task);
    setForm({ title: task.title, skill: task.skill, duration_minutes: task.duration_minutes, time_of_day: task.time_of_day || '', day_of_week: task.day_of_week, every_day: task.every_day });
    setShowModal(true);
  }

  async function saveTask() {
    if (!form.title.trim()) return;
    const body = { ...form, time_of_day: form.time_of_day || null };
    if (editTask) {
      await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editTask.id, ...body }) });
    } else {
      await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    setShowModal(false);
    fetchTasks();
  }

  async function toggleTask(task: Task) {
    const currentlyDone = isEffectivelyComplete(task, activeDay);
    const newCompleted = !currentlyDone;
    const targetDate = getISODateForDay(activeDay);
    await fetch('/api/tasks/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, is_completed: newCompleted, target_date: targetDate }),
    });
    const completedAt = newCompleted ? `${targetDate}T12:00:00.000Z` : null;
    setTasks(prev => prev.map(t => t.id === task.id
      ? { ...t, is_completed: newCompleted, completed_at: completedAt }
      : t
    ));
  }

  async function deleteTask(id: number) {
    await fetch('/api/tasks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  const dayTasks = tasks.filter(t => t.every_day || t.day_of_week === activeDay);
  const completedCount = dayTasks.filter(t => isEffectivelyComplete(t, activeDay)).length;

  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>
            Precision Schedule
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#8c90a1' }}>Weekly routine · repeats every 7 days</p>
        </div>
        <button onClick={() => setShowSchedule(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all"
          style={{ background: 'rgba(175,198,255,0.08)', border: '1px solid rgba(175,198,255,0.2)', color: '#afc6ff' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.15)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.08)'}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_view_week</span>
          <span className="hidden sm:inline tracking-widest uppercase">View All</span>
        </button>
      </div>

      {/* Day Scroller */}
      <div className="mb-6">
        <div className="flex gap-2 w-full">
          {DAYS.map((day, i) => {
            const active = i === activeDay;
            const dateNum = getDateForDay(i);
            return (
              <button key={i} onClick={() => setActiveDay(i)}
                className="flex-1 flex flex-col items-center justify-center rounded-2xl transition-all duration-300 relative"
                style={active ? {
                  height: 96, cursor: 'pointer',
                  background: 'rgba(84,141,255,0.2)',
                  border: '1px solid rgba(175,198,255,0.5)',
                  boxShadow: '0 0 15px rgba(175,198,255,0.25)',
                  marginTop: -6, marginBottom: 6,
                } : {
                  height: 80, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  opacity: 0.65,
                }}>
                <span className="font-bold tracking-widest uppercase"
                  style={{ color: active ? '#afc6ff' : '#c1c6d8', fontSize: active ? '11px' : '9px' }}>{day}</span>
                <span className="font-black mt-0.5"
                  style={{ fontFamily: 'var(--font-jakarta)', color: active ? '#afc6ff' : '#e4e1e9', fontSize: active ? '22px' : '18px', lineHeight: 1 }}>
                  {dateNum}
                </span>
                {active && <div className="absolute bottom-2 w-1 h-1 rounded-full" style={{ background: '#afc6ff' }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      {dayTasks.length > 0 && (
        <div className="mb-5 rounded-2xl p-4 glass-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold" style={{ color: '#e4e1e9' }}>{DAYS[activeDay]} — {completedCount}/{dayTasks.length} complete</span>
            <span className="text-xs font-bold" style={{ color: '#c3f400' }}>{Math.round(dayTasks.length ? (completedCount / dayTasks.length) * 100 : 0)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${dayTasks.length ? (completedCount / dayTasks.length) * 100 : 0}%`, background: 'linear-gradient(90deg, #c3f400, #abd600)' }} />
          </div>
        </div>
      )}

      {/* Task List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-3xl" style={{ color: '#afc6ff' }}>progress_activity</span>
        </div>
      ) : dayTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-5xl mb-4" style={{ color: '#414655' }}>task_alt</span>
          <p className="font-semibold" style={{ color: '#8c90a1' }}>No tasks for {DAYS[activeDay]}</p>
          <p className="text-sm mt-1 mb-5" style={{ color: '#414655' }}>Add your first task to build your routine</p>
          <button onClick={openAdd} className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(175,198,255,0.1)', border: '1px solid rgba(175,198,255,0.2)', color: '#afc6ff' }}>
            + Add Task
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {dayTasks.map(task => {
            const meta = SKILL_META[task.skill] || SKILL_META.energy;
            const done = isEffectivelyComplete(task, activeDay);
            return (
              <div key={task.id}
                className="glass-card rounded-2xl p-5 flex gap-4 group transition-all"
                style={{
                  borderLeft: `4px solid ${meta.color}`,
                  opacity: done ? 0.55 : 1,
                  transform: done ? 'scale(0.99)' : 'scale(1)',
                }}>

                {/* Checkbox */}
                <div className="flex flex-col items-center justify-start pt-0.5">
                  <button onClick={() => toggleTask(task)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      border: `2px solid ${done ? meta.color : meta.color + '60'}`,
                      background: done ? meta.color : 'transparent',
                      cursor: 'pointer',
                    }}>
                    {done && (
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#000', fontVariationSettings: "'FILL' 1" }}>check</span>
                    )}
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold tracking-widest uppercase" style={{ color: meta.color }}>
                      {task.skill.toUpperCase()}
                      {task.every_day && ' · EVERY DAY'}
                    </span>
                    {task.time_of_day && (
                      <span className="text-xs" style={{ color: '#8c90a1' }}>{task.time_of_day}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-base mb-2" style={{ color: '#e4e1e9', textDecoration: done ? 'line-through' : 'none' }}>
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold"
                      style={{ background: meta.bg, color: meta.color, outline: `1px solid ${meta.color}30` }}>
                      {task.skill.toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold"
                      style={{ background: 'rgba(53,52,58,0.8)', color: '#c1c6d8' }}>
                      {task.duration_minutes} MIN
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(task)} className="p-1 rounded-lg" style={{ color: '#8c90a1' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#afc6ff'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#8c90a1'}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                  </button>
                  <button onClick={() => deleteTask(task.id)} className="p-1 rounded-lg" style={{ color: '#8c90a1' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ffb4ab'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#8c90a1'}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button onClick={openAdd}
        className="fixed bottom-24 md:bottom-8 right-6 md:right-8 w-14 h-14 rounded-2xl flex items-center justify-center z-40 transition-all active:scale-90"
        style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 30px rgba(175,198,255,0.4)', cursor: 'pointer' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '28px', fontVariationSettings: "'wght' 600" }}>add</span>
      </button>

      {/* Weekly Schedule Modal */}
      {showSchedule && (() => {
        const everyDay = tasks.filter(t => t.every_day).sort((a, b) => (a.time_of_day || '').localeCompare(b.time_of_day || ''));
        const byDay = DAYS.map((label, i) => ({
          label,
          tasks: tasks.filter(t => !t.every_day && t.day_of_week === i).sort((a, b) => (a.time_of_day || '').localeCompare(b.time_of_day || '')),
        }));
        const totalMins = tasks.reduce((s, t) => s + t.duration_minutes, 0);

        return (
          <div className="fixed inset-0 z-50 flex flex-col animate-fade-in"
            style={{ background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(12px)' }}>

            <div className="flex items-center justify-between px-6 py-5 flex-shrink-0 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div>
                <h2 className="text-2xl font-black tracking-tight" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>Weekly Schedule</h2>
                <p className="text-sm mt-0.5" style={{ color: '#8c90a1' }}>
                  {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {Math.round(totalMins / 60 * 10) / 10}h per week
                </p>
              </div>
              <button onClick={() => setShowSchedule(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e1e9' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 py-6 max-w-3xl mx-auto w-full">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <span className="material-symbols-outlined text-6xl mb-4" style={{ color: '#414655' }}>calendar_view_week</span>
                  <p className="font-semibold text-lg" style={{ color: '#8c90a1' }}>No tasks yet</p>
                  <p className="text-sm mt-1" style={{ color: '#414655' }}>Add tasks to build your routine</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Every Day */}
                  {everyDay.length > 0 && (
                    <div>
                      <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#afc6ff' }}>Every Day</p>
                      <div className="flex flex-col gap-2">
                        {everyDay.map(task => {
                          const meta = SKILL_META[task.skill] || SKILL_META.energy;
                          return (
                            <div key={task.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${meta.color}` }}>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: '#e4e1e9' }}>{task.title}</p>
                                <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>
                                  <span style={{ color: meta.color }}>{task.skill}</span>
                                  {' · '}{task.duration_minutes}m
                                  {task.time_of_day && <span> · {task.time_of_day}</span>}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Day-specific */}
                  {byDay.filter(d => d.tasks.length > 0).map(({ label, tasks: dayTasks }) => (
                    <div key={label}>
                      <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#8c90a1' }}>{label}</p>
                      <div className="flex flex-col gap-2">
                        {dayTasks.map(task => {
                          const meta = SKILL_META[task.skill] || SKILL_META.energy;
                          return (
                            <div key={task.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${meta.color}` }}>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: '#e4e1e9' }}>{task.title}</p>
                                <p className="text-xs mt-0.5" style={{ color: '#8c90a1' }}>
                                  <span style={{ color: meta.color }}>{task.skill}</span>
                                  {' · '}{task.duration_minutes}m
                                  {task.time_of_day && <span> · {task.time_of_day}</span>}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Modal — click backdrop to close */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowModal(false)}>
          <div className="w-full md:max-w-md rounded-t-3xl md:rounded-2xl p-6 animate-slide-up"
            style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-lg" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>
                {editTask ? 'Edit Task' : 'New Task'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ color: '#8c90a1' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Title */}
              <div>
                <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: '#c1c6d8' }}>Task Name</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Morning run, Read 30 pages..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e1e9' }}
                  onFocus={e => e.target.style.borderColor = '#afc6ff'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              {/* Skill */}
              <div>
                <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: '#c1c6d8' }}>Skill</label>
                <div className="grid grid-cols-3 gap-2">
                  {SKILLS.map(skill => {
                    const meta = SKILL_META[skill];
                    const sel = form.skill === skill;
                    return (
                      <button key={skill} onClick={() => setForm(f => ({ ...f, skill }))}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all text-xs font-semibold capitalize"
                        style={{ background: sel ? meta.bg : 'rgba(255,255,255,0.04)', border: `1px solid ${sel ? meta.color : 'rgba(255,255,255,0.08)'}`, color: sel ? meta.color : '#8c90a1' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: sel ? meta.color : 'rgba(255,255,255,0.3)' }}>{meta.icon}</span>
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Every Day toggle */}
              <div>
                <button onClick={() => setForm(f => ({ ...f, every_day: !f.every_day }))}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: form.every_day ? 'rgba(175,198,255,0.1)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${form.every_day ? 'rgba(175,198,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  }}>
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: form.every_day ? '#afc6ff' : 'transparent', border: `2px solid ${form.every_day ? '#afc6ff' : 'rgba(255,255,255,0.2)'}` }}>
                    {form.every_day && <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#002d6d', fontVariationSettings: "'FILL' 1" }}>check</span>}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold" style={{ color: form.every_day ? '#afc6ff' : '#e4e1e9' }}>Every Day</p>
                    <p className="text-xs" style={{ color: '#8c90a1' }}>Task repeats on all 7 days</p>
                  </div>
                </button>
              </div>

              {/* Day selector */}
              <div style={{ opacity: form.every_day ? 0.35 : 1, pointerEvents: form.every_day ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
                <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: '#c1c6d8' }}>Day of Week</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS.map((d, i) => (
                    <button key={i} onClick={() => setForm(f => ({ ...f, day_of_week: i }))}
                      className="py-2 rounded-xl text-xs font-bold transition-all"
                      style={form.day_of_week === i && !form.every_day
                        ? { background: 'rgba(84,141,255,0.2)', border: '1px solid rgba(175,198,255,0.5)', color: '#afc6ff' }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#8c90a1' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: '#c1c6d8' }}>Duration</label>
                  <div className="flex gap-1.5">
                    {[15, 30, 60, 90, 120].map(mins => {
                      const sel = form.duration_minutes === mins;
                      return (
                        <button key={mins} onClick={() => setForm(f => ({ ...f, duration_minutes: mins }))}
                          className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                          style={sel
                            ? { background: 'rgba(175,198,255,0.15)', border: '1px solid #afc6ff', color: '#afc6ff' }
                            : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#8c90a1' }}>
                          {mins < 60 ? `${mins}m` : `${mins/60}h`}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold tracking-widest uppercase mb-1.5 block" style={{ color: '#c1c6d8' }}>Time <span style={{ color: '#414655', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <input type="time" value={form.time_of_day} onChange={e => setForm(f => ({ ...f, time_of_day: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e1e9' }}
                    onFocus={e => e.target.style.borderColor = '#afc6ff'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-1">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#c1c6d8' }}>Cancel</button>
                <button onClick={saveTask} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: '#afc6ff', color: '#002d6d', boxShadow: '0 0 15px rgba(175,198,255,0.25)' }}>
                  {editTask ? 'Save Changes' : 'Add Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
