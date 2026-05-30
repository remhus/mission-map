'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); setLoading(false); return; }
      router.push('/dashboard');
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col md:flex-row min-h-screen w-full overflow-hidden" style={{ background: '#0A0A0F' }}>
      {/* Left â€” cinematic panel (desktop only) */}
      <section className="hidden md:flex md:w-3/5 relative h-screen overflow-hidden flex-col justify-between p-10">
        <div className="absolute inset-0 z-0" style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #0d1a35 50%, #0A0A0F 100%)',
        }} />
        {/* Animated grid lines */}
        <div className="absolute inset-0 z-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(175,198,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(175,198,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(84,141,255,0.15) 0%, transparent 60%)' }} />

        <div className="relative z-10">
          <h1 className="text-5xl font-black tracking-tighter uppercase" style={{ fontFamily: 'var(--font-jakarta)', color: '#d9e2ff' }}>
            MISSION MAP
          </h1>
          <p className="text-xs font-bold tracking-widest mt-2 uppercase" style={{ color: 'rgba(175,198,255,0.6)' }}>
            Map your mission. Build your legacy.
          </p>
        </div>

        <div className="relative z-10 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6 text-xs font-bold tracking-widest uppercase"
            style={{ background: 'rgba(175,198,255,0.1)', border: '1px solid rgba(175,198,255,0.2)', color: '#afc6ff' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            SYSTEM OPTIMISED
          </div>
          <p className="text-xl font-semibold leading-relaxed italic" style={{ color: 'rgba(228,225,233,0.8)' }}>
            "Ambition is the path to success. Persistence is the vehicle you arrive in."
          </p>
          <p className="text-sm font-bold mt-2 tracking-widest uppercase" style={{ color: 'rgba(175,198,255,0.5)' }}>
            — Bill Bradley
          </p>

        </div>
      </section>

      {/* Right â€” login form */}
      <section className="w-full md:w-2/5 flex items-center justify-center p-6 md:p-10 relative min-h-screen"
        style={{ background: '#131318' }}>

        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile brand */}
          <div className="md:hidden mb-8 text-center">
            <h1 className="text-3xl font-black tracking-tighter uppercase" style={{ fontFamily: 'var(--font-jakarta)', color: '#d9e2ff' }}>MISSION MAP</h1>
            <p className="text-xs tracking-widest uppercase mt-1" style={{ color: 'rgba(175,198,255,0.6)' }}>Map your mission. Build your legacy.</p>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black tracking-tight" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>Welcome back</h2>
            <p className="mt-1 text-sm" style={{ color: '#8c90a1' }}>Sign in to mission control</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c1c6d8' }}>Email</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#8c90a1', fontSize: '18px' }}>mail</span>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e1e9' }}
                  onFocus={e => { e.target.style.borderColor = '#afc6ff'; e.target.style.boxShadow = '0 0 0 3px rgba(175,198,255,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c1c6d8' }}>Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8c90a1', fontSize: '18px' }}>lock</span>
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="Your password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e1e9' }}
                  onFocus={e => { e.target.style.borderColor = '#afc6ff'; e.target.style.boxShadow = '0 0 0 3px rgba(175,198,255,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8c90a1' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showPass ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(147,0,10,0.3)', border: '1px solid rgba(255,180,171,0.3)', color: '#ffb4ab' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all mt-2"
              style={{ background: loading ? 'rgba(175,198,255,0.4)' : '#afc6ff', color: '#002d6d', boxShadow: loading ? 'none' : '0 0 20px rgba(175,198,255,0.3)' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-sm" style={{ fontSize: '16px' }}>progress_activity</span>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: '#8c90a1' }}>
            No account?{' '}
            <Link href="/signup" className="font-semibold transition-colors" style={{ color: '#afc6ff' }}>
              Create yours
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

