'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', username: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password, username: form.username }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Signup failed'); setLoading(false); return; }
      router.push('/dashboard');
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col md:flex-row min-h-screen w-full" style={{ background: '#0A0A0F' }}>
      {/* Left panel */}
      <section className="hidden md:flex md:w-2/5 relative h-screen overflow-hidden flex-col justify-between p-10">
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, #0A0A0F 0%, #0d1a35 50%, #0A0A0F 100%)',
        }} />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(175,198,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(175,198,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(200,99,251,0.1) 0%, transparent 60%)' }} />

        <div className="relative z-10">
          <h1 className="text-4xl font-black tracking-tighter uppercase" style={{ fontFamily: 'var(--font-jakarta)', color: '#d9e2ff' }}>MISSION MAP</h1>
          <p className="text-xs font-bold tracking-widest mt-2 uppercase" style={{ color: 'rgba(175,198,255,0.6)' }}>Begin your ascent</p>
        </div>

        <div className="relative z-10">
          <p className="text-lg font-semibold leading-relaxed italic mb-2" style={{ color: 'rgba(228,225,233,0.8)' }}>
            "You don't have to be great to start, but you have to start to be great."
          </p>
          <p className="text-sm font-bold mb-8 tracking-widest uppercase" style={{ color: 'rgba(175,198,255,0.5)' }}>
            — Zig Ziglar
          </p>
          <div className="flex flex-col gap-3">
            {[
              { icon: 'grid_view', text: 'Build your 9x9 Mission Map' },
              { icon: 'emoji_events', text: 'Earn trophy achievements' },
              { icon: 'radar', text: 'Track 8 core skill dimensions' },
              { icon: 'wb_sunny', text: 'Visualise your vision board' },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(175,198,255,0.1)', border: '1px solid rgba(175,198,255,0.2)' }}>
                  <span className="material-symbols-outlined" style={{ color: '#afc6ff', fontSize: '16px' }}>{f.icon}</span>
                </div>
                <span className="text-sm" style={{ color: '#c1c6d8' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Right â€” form */}
      <section className="w-full md:w-3/5 flex items-center justify-center p-6 md:p-10 min-h-screen" style={{ background: '#131318' }}>
        <div className="w-full max-w-sm animate-slide-up">
          <div className="md:hidden mb-8 text-center">
            <h1 className="text-3xl font-black tracking-tighter uppercase" style={{ fontFamily: 'var(--font-jakarta)', color: '#d9e2ff' }}>MISSION MAP</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black tracking-tight" style={{ fontFamily: 'var(--font-jakarta)', color: '#e4e1e9' }}>Create account</h2>
            <p className="mt-1 text-sm" style={{ color: '#8c90a1' }}>Start mapping your mission today</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {[
              { key: 'username', label: 'Username', icon: 'person', type: 'text', placeholder: 'Your name' },
              { key: 'email', label: 'Email', icon: 'mail', type: 'email', placeholder: 'your@email.com' },
            ].map(field => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c1c6d8' }}>{field.label}</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8c90a1', fontSize: '18px' }}>{field.icon}</span>
                  <input type={field.type} value={form[field.key as keyof typeof form]}
                    onChange={e => update(field.key, e.target.value)} required placeholder={field.placeholder}
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e1e9' }}
                    onFocus={e => { e.target.style.borderColor = '#afc6ff'; e.target.style.boxShadow = '0 0 0 3px rgba(175,198,255,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>
            ))}

            {[
              { key: 'password', label: 'Password', placeholder: 'Min 8 characters' },
              { key: 'confirm', label: 'Confirm Password', placeholder: 'Repeat password' },
            ].map(field => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold tracking-widest uppercase" style={{ color: '#c1c6d8' }}>{field.label}</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8c90a1', fontSize: '18px' }}>lock</span>
                  <input type={showPass ? 'text' : 'password'} value={form[field.key as keyof typeof form]}
                    onChange={e => update(field.key, e.target.value)} required placeholder={field.placeholder}
                    className="w-full pl-10 pr-10 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e1e9' }}
                    onFocus={e => { e.target.style.borderColor = '#afc6ff'; e.target.style.boxShadow = '0 0 0 3px rgba(175,198,255,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                  />
                  {field.key === 'confirm' && (
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8c90a1' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showPass ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(147,0,10,0.3)', border: '1px solid rgba(255,180,171,0.3)', color: '#ffb4ab' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all mt-2"
              style={{ background: loading ? 'rgba(175,198,255,0.4)' : '#afc6ff', color: '#002d6d', boxShadow: loading ? 'none' : '0 0 20px rgba(175,198,255,0.3)' }}>
              {loading ? 'Creating account...' : 'Start My Mission'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: '#8c90a1' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold" style={{ color: '#afc6ff' }}>Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

