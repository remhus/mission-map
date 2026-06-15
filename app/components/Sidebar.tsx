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
}

export default function Sidebar({ username, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const w = collapsed ? 64 : 288;

  const rowLayout = (extra?: React.CSSProperties): React.CSSProperties => ({
    gap: collapsed ? 0 : 12,
    padding: collapsed ? '11px 0' : '11px 12px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    ...extra,
  });

  return (
    <aside
      className="fixed left-0 top-0 h-full hidden md:flex flex-col z-40 pt-20 transition-all duration-300"
      style={{
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
              <p className="font-semibold text-sm truncate text-accent">{username}</p>
              <p className="text-xs tracking-widest uppercase text-muted">Mission Active</p>
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
              className={`nav-item ${active ? 'nav-item-active' : ''} flex items-center rounded-xl flex-shrink-0`}
              style={rowLayout()}>
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

        {/* Collapse / expand toggle */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="nav-item flex items-center rounded-xl w-full"
          style={rowLayout()}>
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '22px' }}>
            {collapsed ? 'left_panel_open' : 'left_panel_close'}
          </span>
          {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Collapse</span>}
        </button>

        {/* Settings */}
        <Link href="/settings"
          title={collapsed ? 'Settings' : undefined}
          className="nav-item flex items-center rounded-xl"
          style={rowLayout()}>
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '22px' }}>settings</span>
          {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Settings</span>}
        </Link>

        {/* Sign out */}
        <button onClick={handleLogout}
          title={collapsed ? 'Sign Out' : undefined}
          aria-label="Sign out"
          className="nav-item nav-item-to-danger flex items-center rounded-xl w-full"
          style={rowLayout()}>
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '22px' }}>logout</span>
          {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
