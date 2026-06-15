'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

export default function SettingsPage() {
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <PageHeader title="Settings" />

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
    </div>
  );
}
