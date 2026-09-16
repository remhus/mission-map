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

  const [ptEnabled, setPtEnabled] = useState(false);
  const [ptSlug, setPtSlug] = useState('');
  const [ptSlugDraft, setPtSlugDraft] = useState('');
  const [ptUrl, setPtUrl] = useState<string | null>(null);
  const [ptShared, setPtShared] = useState(0);
  const [ptTotal, setPtTotal] = useState(0);
  const [ptLoading, setPtLoading] = useState(true);
  const [ptSaving, setPtSaving] = useState(false);
  const [ptError, setPtError] = useState('');
  const [ptCopied, setPtCopied] = useState(false);

  useEffect(() => {
    fetch('/api/settings/weekly-quest')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setWqEnabled(d.enabled); setWqTimezone(d.timezone); } })
      .finally(() => setWqLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/settings/public-trophies')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setPtEnabled(d.enabled);
        setPtSlug(d.slug || '');
        setPtSlugDraft(d.slug || '');
        setPtUrl(d.url || null);
        setPtShared(d.shared ?? 0);
        setPtTotal(d.total ?? 0);
      })
      .finally(() => setPtLoading(false));
  }, []);

  async function savePt(enabled: boolean, slug?: string) {
    setPtSaving(true);
    setPtError('');
    const res = await fetch('/api/settings/public-trophies', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, slug }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setPtEnabled(d.enabled);
      setPtSlug(d.slug || '');
      setPtSlugDraft(d.slug || '');
      setPtUrl(d.url || null);
    } else {
      setPtError(d.error || 'Could not save. Please try again.');
      setPtSlugDraft(ptSlug);
    }
    setPtSaving(false);
  }

  async function copyFeedUrl() {
    if (!ptUrl) return;
    try {
      await navigator.clipboard.writeText(ptUrl);
      setPtCopied(true);
      setTimeout(() => setPtCopied(false), 1600);
    } catch { /* clipboard unavailable — the field is selectable */ }
  }

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

      {/* Public Trophy Sharing */}
      <div className="rounded-2xl p-6 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="font-bold text-ink flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#ffd700' }}>emoji_events</span>
              Public Trophy Feed
            </h2>
            <p className="text-sm mt-1 text-muted">
              Publish your trophy room as a read-only feed any website can display. Individual trophies can be hidden from Edit Trophy.
            </p>
          </div>
          <button
            role="switch" aria-checked={ptEnabled} aria-label="Toggle public trophy feed"
            onClick={() => savePt(!ptEnabled)} disabled={ptLoading || ptSaving}
            className="relative flex-shrink-0 rounded-full transition-colors duration-200"
            style={{ width: 48, height: 28, background: ptEnabled ? '#548dff' : 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="absolute top-1/2 rounded-full transition-all duration-200"
              style={{ width: 20, height: 20, background: '#fff', transform: `translateY(-50%) translateX(${ptEnabled ? 24 : 4}px)` }} />
          </button>
        </div>

        <div className="rounded-xl p-3.5 mb-4" style={{ background: 'rgba(84,141,255,0.05)', border: '1px solid rgba(84,141,255,0.15)' }}>
          <div className="flex gap-2.5">
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '17px', color: '#548dff' }}>info</span>
            <p className="text-xs leading-relaxed text-ink-2">
              Only the <strong>title, description, tier and achieved status</strong> of each trophy is published. Tasks, journal,
              grid, vision board and account details are never included. While the feed is off, nothing is reachable at all.
            </p>
          </div>
        </div>

        {ptEnabled && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold tracking-widest uppercase text-muted block mb-1.5" htmlFor="pt-handle">Public handle</label>
              <div className="flex gap-2">
                <input
                  id="pt-handle" value={ptSlugDraft} disabled={ptSaving}
                  onChange={e => setPtSlugDraft(e.target.value.toLowerCase())}
                  onKeyDown={e => { if (e.key === 'Enter' && ptSlugDraft !== ptSlug) savePt(true, ptSlugDraft); }}
                  placeholder="my-handle" spellCheck={false} autoComplete="off"
                  className="input-field flex-1 px-3 py-2.5 rounded-xl text-sm"
                />
                <button
                  onClick={() => savePt(true, ptSlugDraft)}
                  disabled={ptSaving || ptSlugDraft === ptSlug || !ptSlugDraft}
                  className="btn-soft-accent px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40">
                  Save
                </button>
              </div>
              <p className="text-xs mt-1.5 text-faint">Lowercase letters, numbers and hyphens. Changing it breaks any existing link.</p>
              {ptError && <p className="text-xs mt-1.5 text-danger">{ptError}</p>}
            </div>

            {ptUrl && (
              <div>
                <label className="text-xs font-bold tracking-widest uppercase text-muted block mb-1.5">Feed URL</label>
                <div className="flex gap-2">
                  <input readOnly value={ptUrl} onFocus={e => e.currentTarget.select()}
                    className="input-field flex-1 px-3 py-2.5 rounded-xl text-xs font-mono" />
                  <button onClick={copyFeedUrl} aria-label="Copy feed URL"
                    className="btn-soft-accent px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{ptCopied ? 'check' : 'content_copy'}</span>
                    {ptCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs mt-1.5 text-faint">
                  Sharing {ptShared} of {ptTotal} {ptTotal === 1 ? 'trophy' : 'trophies'}. Give this URL to the site that should display them.
                </p>
              </div>
            )}
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
