'use client';

import { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppShell({ username, children }: { username: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setCollapsed(true);
    setReady(true);
  }, []);

  function toggle() {
    setCollapsed(v => {
      localStorage.setItem('sidebar-collapsed', String(!v));
      return !v;
    });
  }

  const sidebarWidth = collapsed ? 64 : 288;

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#0A0A0F' }}>
      <Header username={username} />
      <Sidebar username={username} collapsed={collapsed} onToggle={toggle} ready={ready} />
      <main
        className="hidden md:block pt-20 pb-20 md:pb-0 min-h-screen overflow-x-hidden"
        style={{ marginLeft: sidebarWidth, transition: ready ? 'margin-left 300ms' : 'none' }}>
        {children}
      </main>
      {/* Mobile: no sidebar offset */}
      <main className="md:hidden pt-20 pb-20 min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
