'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';

const COMMON_TIMEZONES = [
  'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Europe/Moscow', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore',
  'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'UTC',
];

function timezoneOptions(current: string): string[] {
  let list: string[] = COMMON_TIMEZONES;
  try {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
    if (all && all.length) list = all;
  } catch { /* fall back to common list */ }
  return list.includes(current) ? list : [current, ...list];
}

export default function SettingsPage() {
  const router = useRouter();

  const [wqEnabled, setWqEnabled] = useState(false);
  const [wqTimezone, setWqTimezone] = useState('Europe/London');
  const [wqLoading, setWqLoading] = useState(true);
  const [wqSaving, setWqSaving] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  useEffect(() => {
    fetch('/api/settings/weekly-quest')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setWqEnabled(d.enabled); setWqTimezone(d.timezone); } })
      .finally(() => setWqLoading(false));
  }, []);

  async function saveWq(enabled: boolean, timezone: string) {
    setWqSaving(true);
    const res = await fetch('/api/settings/weekly-quest', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, timezone }),
    });
    if (res.ok) { const d = await res.json(); setWqEnabled(d.enabled); setWqTimezone(d.timezone); }
    setWqSaving(false);
  }

  function onToggle() {
    if (wqEnabled) { setConfirmDisable(true); return; }
    saveWq(true, wqTimezone);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <PageHeader title="Settings" />

      {/* Weekly AI Quests */}
      <div className="rounded-2xl p-6 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="font-bold text-ink flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#afc6ff' }}>swords</span>
              Weekly AI Quests
            </h2>
            <p className="text-sm mt-1 text-muted">One AI-crafted challenge each week, built from your mission and progress.</p>
          </div>
          <button
            role="switch" aria-checked={wqEnabled} aria-label="Toggle weekly AI quests"
            onClick={onToggle} disabled={wqLoading || wqSaving}
            className="relative flex-shrink-0 rounded-full transition-colors duration-200"
            style={{ width: 48, height: 28, background: wqEnabled ? '#548dff' : 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="absolute top-1/2 rounded-full transition-all duration-200"
              style={{ width: 20, height: 20, background: '#fff', transform: `translateY(-50%) translateX(${wqEnabled ? 24 : 4}px)` }} />
          </button>
        </div>

        <div className="rounded-xl p-3.5 mb-4" style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}>
          <div className="flex gap-2.5">
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '17px', color: '#ffd700' }}>info</span>
            <p className="text-xs leading-relaxed text-ink-2">
              When enabled, relevant text from your grid and progress is sent to <strong>Google Gemini</strong> to generate a quest.
              This isn&apos;t local or private, and free-tier availability isn&apos;t guaranteed.
              You choose a C, B, A or S rank each week (C easiest, S hardest — all safe and realistic), with one reroll allowed.
            </p>
          </div>
        </div>

        {wqEnabled && (
          <div>
            <label className="text-xs font-bold tracking-widest uppercase text-muted block mb-1.5">Timezone (for week start)</label>
            <select value={wqTimezone} onChange={e => saveWq(true, e.target.value)} disabled={wqSaving}
              className="input-field w-full px-3 py-2.5 rounded-xl text-sm">
              {timezoneOptions(wqTimezone).map(tz => <option key={tz} value={tz} style={{ background: '#1f1f25' }}>{tz}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Account */}
      <div className="rounded-2xl p-6 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h2 className="font-bold mb-4 text-ink">Account</h2>
        <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-colors duration-150 text-danger bg-[rgba(147,0,10,0.2)] hover:bg-[rgba(147,0,10,0.35)]"
          style={{ border: '1px solid rgba(255,180,171,0.2)' }}>
          <span className="material-symbols-outlined">logout</span>
          <span className="font-semibold">Sign Out</span>
        </button>
      </div>

      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h2 className="font-bold mb-2 text-ink">About</h2>
        <p className="text-sm leading-relaxed text-muted">
          Mission Map - track your goals, build your skills, and visualise your legacy.
        </p>
        <p className="text-xs mt-3 text-faint">Version 1.0 - Built with Next.js + Neon</p>
      </div>

      <ConfirmDialog
        open={confirmDisable}
        title="Turn off weekly quests?"
        message="Future quests won't be generated. Your existing quest history is kept and nothing is deleted. You can re-enable any time."
        confirmLabel="Turn off"
        onConfirm={() => { setConfirmDisable(false); saveWq(false, wqTimezone); }}
        onCancel={() => setConfirmDisable(false)}
      />
    </div>
  );
}
