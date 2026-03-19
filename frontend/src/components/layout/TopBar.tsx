'use client';

import { Search, Bell, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

interface TopBarProps {
  onSearchOpen: () => void;
  onMobileMenuOpen: () => void;
  title?: string;
}

export function TopBar({ onSearchOpen, onMobileMenuOpen }: TopBarProps) {
  const notifications = useAppStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <header
      className="h-11 flex items-center justify-between px-4 border-b border-[#262626] bg-[#0A0A0A] flex-shrink-0"
      role="banner"
    >
      {/* Left: mobile menu trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuOpen}
          className={cn(
            'md:hidden flex items-center justify-center w-7 h-7 rounded',
            'text-[#737373] hover:text-[#E5E5E5] hover:bg-[#1A1A1A] transition-colors duration-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]'
          )}
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
        >
          <Menu size={15} aria-hidden />
        </button>
      </div>

      {/* Right: search + notifications */}
      <div className="flex items-center gap-1">
        {/* Command palette trigger */}
        <button
          onClick={onSearchOpen}
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] text-sm text-[#737373]',
            'hover:text-[#E5E5E5] hover:bg-[#1A1A1A] transition-colors duration-100',
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

        {/* Notifications */}
        <button
          className={cn(
            'relative flex items-center justify-center w-7 h-7 rounded-[7px]',
            'text-[#737373] hover:text-[#E5E5E5] hover:bg-[#1A1A1A]',
            'transition-colors duration-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]'
          )}
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        >
          <Bell size={13} aria-hidden />
          {unread > 0 && (
            <span
              className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#C9A227]"
              aria-hidden="true"
            />
          )}
        </button>
      </div>
    </header>
  );
}
