'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function QuestAdmin() {
  const [prompt, setPrompt] = useState('');
  const [gridReady, setGridReady] = useState<string>('ready');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [copied, setCopied] = useState(false);

  const [paste, setPaste] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; details?: string[] } | null>(null);

  useEffect(() => {
    fetch('/api/weekly-quest/prompt')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setPrompt(d.prompt); setGridReady(d.gridReady); } })
      .finally(() => setLoadingPrompt(false));
  }, []);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  }

  async function doImport() {
    setImporting(true); setResult(null);
    try {
      const res = await fetch('/api/weekly-quest/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: paste }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({ ok: true, message: `Imported ${d.offers?.length ?? 4} quests. Your board is ready.` });
        setPaste('');
      } else {
        setResult({ ok: false, message: d.error || 'Import failed.', details: d.details });
      }
    } catch {
      setResult({ ok: false, message: 'Network error — please try again.' });
    } finally {
      setImporting(false);
    }
  }

  const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };

  return (
    <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase mb-1 text-accent">Manual Generation</p>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>Quest Admin</h1>
          <p className="text-sm mt-1 text-muted">Generate a board with any LLM, then paste the result back.</p>
        </div>
        <Link href="/quests" className="btn-ghost flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold flex-shrink-0">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>swords</span>
          Boss Quests
        </Link>
      </div>

      {gridReady === 'empty' ? (
        <div className="rounded-2xl p-8 text-center" style={cardStyle}>
          <span className="material-symbols-outlined mb-3" style={{ color: '#414655', fontSize: '48px' }}>grid_view</span>
          <h2 className="text-lg font-black mb-2 text-white" style={{ fontFamily: 'var(--font-jakarta)' }}>Fill in your grid first</h2>
          <p className="text-sm text-muted mb-6">The prompt is built from your Mandala grid. Add your goal and at least one pillar.</p>
          <Link href="/dashboard" className="btn-soft-accent inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold">Open the Grid</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Step 1 — prompt */}
          <div className="rounded-2xl p-6" style={cardStyle}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-black text-white flex items-center gap-2" style={{ fontFamily: 'var(--font-jakarta)' }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: 'rgba(175,198,255,0.15)', color: '#afc6ff' }}>1</span>
                Copy this prompt
              </h2>
              <button onClick={copyPrompt} disabled={loadingPrompt || !prompt} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{copied ? 'check' : 'content_copy'}</span>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-sm text-muted mb-3">
              Paste it into any capable LLM (ChatGPT, Claude, etc.). It returns a JSON array of four quests.
              {prompt && !loadingPrompt && <span className="text-ink-2"> This prompt already has your mission and grid baked in — scroll down inside it to see your data.</span>}
            </p>
            <textarea readOnly value={loadingPrompt ? 'Building prompt from your grid…' : prompt}
              className="input-field w-full rounded-xl p-3 text-xs custom-scrollbar"
              style={{ fontFamily: 'ui-monospace, monospace', height: 340, resize: 'vertical', lineHeight: 1.55 }} />
          </div>

          {/* Step 2 — paste */}
          <div className="rounded-2xl p-6" style={cardStyle}>
            <h2 className="font-black text-white flex items-center gap-2 mb-3" style={{ fontFamily: 'var(--font-jakarta)' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: 'rgba(175,198,255,0.15)', color: '#afc6ff' }}>2</span>
              Paste the JSON response
            </h2>
            <textarea value={paste} onChange={e => setPaste(e.target.value)}
              placeholder='[ { "title": "...", "rank": "C", "objective": "...", "victoryCondition": "...", "targetPillar": "...", "targetSubCell": "...", "estimatedHours": 2, "skillXp": { "energy": 0, ... } }, ... ]'
              className="input-field w-full rounded-xl p-3 text-xs custom-scrollbar"
              style={{ fontFamily: 'ui-monospace, monospace', height: 180, resize: 'vertical', lineHeight: 1.5 }} />
            <div className="flex items-center gap-3 mt-3">
              <button onClick={doImport} disabled={importing || !paste.trim()} className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>publish</span>
                {importing ? 'Importing…' : 'Import Board'}
              </button>
              {result?.ok && (
                <Link href="/quests" className="btn-soft-accent flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm">
                  View Board <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                </Link>
              )}
            </div>

            {result && (
              <div className="mt-4 rounded-xl p-3.5" style={result.ok
                ? { background: 'rgba(195,244,0,0.06)', border: '1px solid rgba(195,244,0,0.22)' }
                : { background: 'rgba(255,180,171,0.06)', border: '1px solid rgba(255,180,171,0.25)' }}>
                <p className="text-sm font-semibold" style={{ color: result.ok ? '#c3f400' : '#ffb4ab' }}>{result.message}</p>
                {result.details && (
                  <ul className="mt-1.5 text-xs list-disc pl-4" style={{ color: '#ffb4ab' }}>
                    {result.details.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
