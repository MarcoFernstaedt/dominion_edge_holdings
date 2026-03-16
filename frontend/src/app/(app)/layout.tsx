'use client';

import { useState, useEffect, useCallback } from 'react';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { TopBar } from '@/components/layout/TopBar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { useAppStore } from '@/lib/store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const settings = useAppStore((s) => s.settings);

  const openCommand = useCallback(() => setCommandOpen(true), []);
  const closeCommand = useCallback(() => setCommandOpen(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className={`flex h-screen overflow-hidden bg-[#0B0B0C] ${settings.reducedMotion ? 'reduced-motion' : ''}`}
    >
      {/* Sidebar */}
      <SidebarNav
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onSearchOpen={openCommand} />

        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-[#0D0D0D]"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onClose={closeCommand} />

      {/* Aria live region for status announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="status-announcer"
      />
    </div>
  );
}
