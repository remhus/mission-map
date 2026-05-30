'use client';

import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-8" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>Settings</h1>

      <div className="rounded-2xl p-6 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h2 className="font-bold mb-4" style={{ color: '#e4e1e9' }}>Account</h2>
        <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all"
          style={{ background: 'rgba(147,0,10,0.2)', border: '1px solid rgba(255,180,171,0.2)', color: '#ffb4ab' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(147,0,10,0.35)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(147,0,10,0.2)'}>
          <span className="material-symbols-outlined">logout</span>
          <span className="font-semibold">Sign Out</span>
        </button>
      </div>

      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h2 className="font-bold mb-2" style={{ color: '#e4e1e9' }}>About</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#8c90a1' }}>
          Mission Map - track your goals, build your skills, and visualise your legacy.
        </p>
        <p className="text-xs mt-3" style={{ color: '#414655' }}>Version 1.0 - Built with Next.js + Neon</p>
      </div>
    </div>
  );
}
