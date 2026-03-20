'use client';

import { useState, useEffect, useCallback } from 'react';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { TopBar } from '@/components/layout/TopBar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useAppStore } from '@/lib/store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const settings = useAppStore((s) => s.settings);

  const openCommand = useCallback(() => setCommandOpen(true), []);
  const closeCommand = useCallback(() => setCommandOpen(false), []);

  // Close mobile sidebar on route change (children re-render)
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [children]);

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileSidebarOpen(false);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
      // Escape closes mobile sidebar
      if (e.key === 'Escape' && mobileSidebarOpen) {
        setMobileSidebarOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileSidebarOpen]);

  return (
    <div
      className={`flex h-screen overflow-hidden bg-[#0B0B0C] ${settings.reducedMotion ? 'reduced-motion' : ''}`}
    >
      {/* ── Mobile sidebar backdrop ─────────────────────────────────────────── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          aria-hidden="true"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      {/* Desktop: always visible, collapsible */}
      <div className="hidden md:flex h-full flex-shrink-0">
        <SidebarNav
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />
      </div>

      {/* Mobile: slide-in drawer */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 flex h-full flex-shrink-0 md:hidden
          transition-transform duration-200
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${settings.reducedMotion ? '!transition-none' : ''}
        `}
        aria-modal={mobileSidebarOpen}
        aria-label="Mobile navigation"
      >
        <SidebarNav
          collapsed={false}
          onToggle={() => setMobileSidebarOpen(false)}
          isMobile
        />
      </div>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          onSearchOpen={openCommand}
          onMobileMenuOpen={() => setMobileSidebarOpen(true)}
        />

        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden bg-[#0D0D0D]"
          tabIndex={-1}
        >
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      {/* ── Command Palette ─────────────────────────────────────────────────── */}
      <CommandPalette open={commandOpen} onClose={closeCommand} />

      {/* ── Aria live region ────────────────────────────────────────────────── */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="status-announcer"
      />
    </div>
  );
}
