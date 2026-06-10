'use client';

import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppShell({ username, children, initialCollapsed }: {
  username: string;
  children: React.ReactNode;
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    setCollapsed(v => {
      const next = !v;
      document.cookie = `sidebar-collapsed=${next}; path=/; max-age=31536000; SameSite=Lax`;
      return next;
    });
  }

  const sidebarWidth = collapsed ? 64 : 288;

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#0A0A0F' }}>
      <Header username={username} />
      <Sidebar username={username} collapsed={collapsed} onToggle={toggle} />
      <main
        className="hidden md:block pt-20 pb-20 md:pb-0 min-h-screen transition-all duration-300 overflow-x-hidden"
        style={{ marginLeft: sidebarWidth }}>
        {children}
      </main>
      <main className="md:hidden pt-20 pb-20 min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
