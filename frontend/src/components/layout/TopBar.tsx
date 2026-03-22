'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Menu, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationsPanel } from './NotificationsPanel';
import { logout, getAuthStatus } from '@/lib/auth';
import { useState, useEffect } from 'react';

interface TopBarProps {
  onSearchOpen: () => void;
  onMobileMenuOpen: () => void;
  title?: string;
}

export function TopBar({ onSearchOpen, onMobileMenuOpen }: TopBarProps) {
  const router = useRouter();
  const [authEnabled, setAuthEnabled] = useState(false);

  useEffect(() => {
    getAuthStatus().then((s) => s && setAuthEnabled(s.authEnabled));
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <header
      className="h-12 flex items-center justify-between px-3 border-b border-[#262626] bg-[#0A0A0A] flex-shrink-0 sticky top-0 z-20"
      role="banner"
    >
      {/* Left: mobile menu trigger */}
      <div className="flex items-center w-9">
        <button
          onClick={onMobileMenuOpen}
          className={cn(
            'md:hidden flex items-center justify-center w-8 h-8 rounded-lg',
            'text-[#737373] hover:text-[#E5E5E5] hover:bg-[#1A1A1A] transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]'
          )}
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
        >
          <Menu size={16} aria-hidden />
        </button>
      </div>

      {/* Right: search + notifications */}
      <div className="flex items-center gap-1">
        {/* Command palette trigger */}
        <button
          onClick={onSearchOpen}
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] text-sm text-[#737373]',
            'hover:text-[#E5E5E5] hover:bg-[#1A1A1A] transition-colors duration-150',
            'border border-transparent hover:border-[#262626]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]'
          )}
          aria-label="Open command palette (Ctrl+K)"
          aria-keyshortcuts="Control+k Meta+k"
        >
          <Search size={13} aria-hidden />
          <span className="hidden sm:inline text-xs">Search</span>
          <kbd
            className="hidden sm:flex items-center gap-0.5 text-[9px] bg-[#1A1A1A] border border-[#333333] rounded px-1 py-0.5 ml-1 text-[#737373]"
            aria-hidden="true"
          >
            <span>⌘</span>K
          </kbd>
        </button>

        {/* Notifications — live panel with real API data */}
        <NotificationsPanel />

        {/* Logout — only shown when auth is enabled */}
        {authEnabled && (
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg',
              'text-[#737373] hover:text-[#E5E5E5] hover:bg-[#1A1A1A] transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]'
            )}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={14} aria-hidden />
          </button>
        )}
      </div>
    </header>
  );
}
