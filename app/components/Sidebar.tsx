'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard',    icon: 'grid_view',    label: 'Dashboard'    },
  { href: '/achievements', icon: 'emoji_events', label: 'Achievements' },
  { href: '/tasks',        icon: 'task_alt',     label: 'Daily Tasks'  },
  { href: '/journal',      icon: 'menu_book',    label: 'Journal'      },
  { href: '/vision-board', icon: 'wb_sunny',     label: 'Vision Board' },
];

interface SidebarProps {
  username: string;
  collapsed: boolean;
  onToggle: () => void;
  ready: boolean;
}

export default function Sidebar({ username, collapsed, onToggle, ready }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const w = collapsed ? 64 : 288;

  return (
    <aside
      className="fixed left-0 top-0 h-full hidden md:flex flex-col z-40 pt-20"
      style={{
        transition: ready ? 'width 300ms' : 'none',
        width: w,
        background: 'rgba(14,14,19,0.9)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}>

      {/* User badge */}
      <div className="px-3 py-3 flex-shrink-0">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#548dff' }}>
              <span className="text-sm font-black" style={{ color: '#fff' }}>{username.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#548dff' }}>
              <span className="text-sm font-black" style={{ color: '#fff' }}>{username.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate" style={{ color: '#afc6ff' }}>{username}</p>
              <p className="text-xs tracking-widest uppercase" style={{ color: '#8c90a1' }}>Mission Active</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 overflow-y-auto no-scrollbar flex-grow px-2 py-2">
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}
              title={collapsed ? item.label : undefined}
              className="flex items-center rounded-xl transition-all duration-150 flex-shrink-0"
              style={{
                gap: collapsed ? 0 : 12,
                padding: collapsed ? '11px 0' : '11px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                ...(active ? {
                  background: 'rgba(84,141,255,0.18)',
                  color: '#afc6ff',
                } : { color: '#8c90a1' }),
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#e4e1e9'; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8c90a1'; } }}>
              <span className="material-symbols-outlined flex-shrink-0"
                style={{ fontSize: '22px', fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>
                {item.icon}
              </span>
              {!collapsed && (
                <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer — collapse toggle sits directly above settings */}
      <div className="flex-shrink-0 px-2 py-2 flex flex-col gap-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>

        {/* Collapse / expand toggle — Gemini-style */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center rounded-xl transition-all duration-150 w-full"
          style={{
            gap: collapsed ? 0 : 12,
            padding: collapsed ? '11px 0' : '11px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: '#8c90a1',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#e4e1e9'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8c90a1'; }}>
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '22px' }}>
            {collapsed ? 'left_panel_open' : 'left_panel_close'}
          </span>
          {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Collapse</span>}
        </button>

        {/* Settings */}
        <Link href="/settings"
          title={collapsed ? 'Settings' : undefined}
          className="flex items-center rounded-xl transition-all duration-150"
          style={{
            gap: collapsed ? 0 : 12,
            padding: collapsed ? '11px 0' : '11px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: '#8c90a1',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#e4e1e9'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8c90a1'; }}>
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '22px' }}>settings</span>
          {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Settings</span>}
        </Link>

        {/* Sign out */}
        <button onClick={handleLogout}
          title={collapsed ? 'Sign Out' : undefined}
          className="flex items-center rounded-xl transition-all duration-150 w-full"
          style={{
            gap: collapsed ? 0 : 12,
            padding: collapsed ? '11px 0' : '11px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: '#8c90a1',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#ffb4ab'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8c90a1'; }}>
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '22px' }}>logout</span>
          {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
