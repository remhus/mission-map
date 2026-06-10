'use client';

import { useState, useRef, useEffect } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard', icon: 'grid_view', label: 'Dashboard' },
  { href: '/achievements', icon: 'emoji_events', label: 'Achievements' },
  { href: '/tasks', icon: 'task_alt', label: 'Tasks' },
  { href: '/journal', icon: 'menu_book', label: 'Journal' },
  { href: '/vision-board', icon: 'wb_sunny', label: 'Vision' },
];

export default function Header({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center h-20 px-5 md:px-10"
        style={{ background: 'rgba(31,31,37,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.37)' }}>

        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="font-extrabold tracking-tighter text-lg" style={{ color: '#afc6ff', fontFamily: 'var(--font-jakarta)' }}>
            MISSION MAP
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Profile button + dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
              style={{
                background: profileOpen ? '#afc6ff' : '#548dff',
                color: profileOpen ? '#002d6d' : '#fff',
                boxShadow: profileOpen ? '0 0 0 2px rgba(175,198,255,0.4)' : 'none',
              }}>
              {username.charAt(0).toUpperCase()}
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-52 rounded-2xl overflow-hidden animate-fade-in"
                style={{ background: '#1f1f25', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                {/* User info */}
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                      style={{ background: '#548dff', color: '#fff' }}>
                      {username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#e4e1e9' }}>{username}</p>
                      <p className="text-xs" style={{ color: '#8c90a1' }}>Mission Active</p>
                    </div>
                  </div>
                  <Link href="/book-club" onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'rgba(175,198,255,0.08)', border: '1px solid rgba(175,198,255,0.15)', color: '#afc6ff' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.15)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(175,198,255,0.08)'}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>menu_book</span>
                    Book Club
                  </Link>
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  <Link href="/settings" onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                    style={{ color: '#c1c6d8' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>settings</span>
                    Settings
                  </Link>
                  <button onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm w-full text-left transition-colors"
                    style={{ color: '#ffb4ab' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,180,171,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 py-2"
        style={{ background: 'rgba(14,14,19,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all"
              style={{ color: active ? '#afc6ff' : '#8c90a1' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '22px', fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
              <span className="text-[9px] font-bold tracking-wider uppercase">{item.label}</span>
            </Link>
          );
        })}
      </nav>

    </>
  );
}
